#!/usr/bin/env bash
set -euo pipefail

# --- Config (reads from env) ---
: "${AWS_REGION:?Set AWS_REGION}"
: "${AMI_ID:?Set AMI_ID (TestDriver Ami)}"
: "${AWS_LAUNCH_TEMPLATE_ID:?Set AWS_LAUNCH_TEMPLATE_ID}"
: "${AWS_LAUNCH_TEMPLATE_VERSION:=\$Latest}"
: "${AWS_TAG_PREFIX:=td}"
: "${RUNNER_CLASS_ID:=default}"
: "${RESOLUTION:=1440x900}"

TAG_NAME="${AWS_TAG_PREFIX}-"$(date +%s)

echo "Launching AWS Instance..."

# --- 1) Launch instance ---
RUN_JSON=$(aws ec2 run-instances \
  --region "$AWS_REGION" \
  --image-id "$AMI_ID" \
  --launch-template "LaunchTemplateId=$AWS_LAUNCH_TEMPLATE_ID,Version=$AWS_LAUNCH_TEMPLATE_VERSION" \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${TAG_NAME}},{Key=Class,Value=${RUNNER_CLASS_ID}},{Key=TD_RESOLUTION,Value=${RESOLUTION}}]" \
  --output json)

INSTANCE_ID=$(jq -r '.Instances[0].InstanceId' <<<"$RUN_JSON")

echo "Launched: $INSTANCE_ID"
echo "Instance details:"
echo "  Region: $AWS_REGION"
echo "  AMI ID: $AMI_ID"
echo "  Launch Template ID: $AWS_LAUNCH_TEMPLATE_ID"
echo "  Launch Template Version: $AWS_LAUNCH_TEMPLATE_VERSION"

echo "Waiting for instance to be running..."

# --- 2) Wait for running + status checks ---
aws ec2 wait instance-running --region "$AWS_REGION" --instance-ids "$INSTANCE_ID"
echo "✓ Instance is now running"

echo "Waiting for instance to pass status checks..."

aws ec2 wait instance-status-ok --region "$AWS_REGION" --instance-ids "$INSTANCE_ID"
echo "✓ Instance passed all status checks"

# Additional validation - check instance state details
echo "Validating instance readiness..."
INSTANCE_STATE=$(aws ec2 describe-instances --region "$AWS_REGION" --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].{State:State.Name,StatusChecks:StateTransitionReason}' \
  --output json)
echo "Instance state details: $INSTANCE_STATE"

# --- 3) Ensure SSM connectivity ---
echo "Waiting for SSM connectivity..."
echo "This can take several minutes for the SSM agent to be fully ready..."

# First, check if the instance is registered with SSM
echo "Checking SSM instance registration..."
TRIES=0; MAX_TRIES=60
while :; do
  echo "Attempt $((TRIES+1))/$MAX_TRIES: Checking if instance is registered with SSM..."
  
  # Check if instance appears in SSM managed instances
  if aws ssm describe-instance-information \
      --region "$AWS_REGION" \
      --filters "Key=InstanceIds,Values=$INSTANCE_ID" \
      --query 'InstanceInformationList[0].InstanceId' \
      --output text 2>/dev/null | grep -q "$INSTANCE_ID"; then
    echo "✓ Instance is registered with SSM"
    break
  fi
  
  TRIES=$((TRIES+1))
  if [ $TRIES -ge $MAX_TRIES ]; then
    echo "❌ SSM registration timeout - instance may not have proper IAM role or SSM agent"
    echo "Checking instance details for debugging..."
    aws ec2 describe-instances --region "$AWS_REGION" --instance-ids "$INSTANCE_ID" \
      --query 'Reservations[0].Instances[0].{State:State.Name,IAMProfile:IamInstanceProfile.Arn,SecurityGroups:SecurityGroups[].GroupId}' \
      --output table
    exit 2
  fi
  echo "Instance not yet registered with SSM, waiting..."
  sleep 10
done

# Now test SSM command execution
echo "Testing SSM command execution..."
TRIES=0; MAX_TRIES=30
while :; do
  echo "Attempt $((TRIES+1))/$MAX_TRIES: Sending test SSM command..."
  
  if CMD_JSON=$(aws ssm send-command \
      --region "$AWS_REGION" \
      --targets "Key=instanceIds,Values=$INSTANCE_ID" \
      --document-name "AWS-RunPowerShellScript" \
      --parameters 'commands=["echo SSM connectivity test successful"]' \
      --output json 2>/dev/null); then
      
    COMMAND_ID=$(jq -r '.Command.CommandId' <<<"$CMD_JSON")
    echo "✓ SSM command sent successfully (Command ID: $COMMAND_ID)"
    
    # Wait for command to complete and check status
    echo "Waiting for command execution..."
    if aws ssm wait command-executed --region "$AWS_REGION" --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" 2>/dev/null; then
      echo "✓ SSM connectivity confirmed"
      break
    else
      echo "⚠ Command execution may have failed, checking status..."
      CMD_STATUS=$(aws ssm get-command-invocation \
        --region "$AWS_REGION" \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --query 'Status' \
        --output text 2>/dev/null || echo "Unknown")
      echo "Command status: $CMD_STATUS"
      
      if [ "$CMD_STATUS" = "Success" ]; then
        echo "✓ Command actually succeeded"
        break
      fi
    fi
  else
    echo "⚠ Failed to send SSM command"
  fi
  
  TRIES=$((TRIES+1))
  if [ $TRIES -ge $MAX_TRIES ]; then
    echo "❌ SSM command execution timeout"
    echo "Final debugging information:"
    
    # Get SSM agent status
    echo "SSM Agent status on instance:"
    aws ssm describe-instance-information \
      --region "$AWS_REGION" \
      --filters "Key=InstanceIds,Values=$INSTANCE_ID" \
      --query 'InstanceInformationList[0].{PingStatus:PingStatus,LastPingDateTime:LastPingDateTime,AgentVersion:AgentVersion}' \
      --output table 2>/dev/null || echo "Could not retrieve SSM status"
    
    exit 2
  fi
  echo "Retrying in 20 seconds..."
  sleep 20
done

# --- 4) Install/update runner ---
echo "Installing runner..."

# Determine environment and version
TD_CHANNEL="${TD_CHANNEL:-stable}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK_PKG_JSON="${SCRIPT_DIR}/../../../sdk/package.json"
RUNNER_DIR="${SCRIPT_DIR}/../../../runner"

if [ -f "$SDK_PKG_JSON" ]; then
  RUNNER_VERSION=$(jq -r '.version' "$SDK_PKG_JSON")
  echo "Runner version from SDK: $RUNNER_VERSION"
else
  RUNNER_VERSION="$TD_CHANNEL"
  echo "SDK package.json not found, using env tag: $RUNNER_VERSION"
fi

if [ "$TD_CHANNEL" = "dev" ]; then
  echo "Dev mode: packing and uploading local runner to S3..."
  
  # Pack local runner
  TMPDIR=$(mktemp -d)
  pushd "$RUNNER_DIR" > /dev/null
  npm pack --pack-destination "$TMPDIR" > /dev/null 2>&1
  TARBALL=$(ls "$TMPDIR"/*.tgz | head -1)
  popd > /dev/null
  
  # Upload to S3
  S3_BUCKET="${AWS_BUCKET_IMAGE_TRANSFER:-v7-transfer}"
  S3_KEY="runner-dev/$(date +%s)-$(openssl rand -hex 4)/runner.tgz"
  aws s3 cp "$TARBALL" "s3://${S3_BUCKET}/${S3_KEY}" --region "$AWS_REGION"
  
  # Generate presigned URL (15 min)
  DOWNLOAD_URL=$(aws s3 presign "s3://${S3_BUCKET}/${S3_KEY}" --expires-in 900 --region "$AWS_REGION")
  rm -rf "$TMPDIR"
  
  # Build SSM parameters JSON in a temp file to avoid shell escaping issues with URL
  PARAMS_FILE=$(mktemp)
  cat > "$PARAMS_FILE" << 'PARAMS_EOF'
{
  "commands": [
    "Write-Host '=== Starting runner dev install ==='",
    "Write-Host 'Bootstrapping sandbox-agent directory...'",
    "New-Item -ItemType Directory -Path 'C:\\testdriver\\sandbox-agent' -Force | Out-Null",
    "New-Item -ItemType Directory -Path 'C:\\testdriver\\logs' -Force | Out-Null",
    "if (-not (Test-Path 'C:\\testdriver\\sandbox-agent\\package.json')) { '{\"name\":\"td-sandbox\",\"private\":true}' | Set-Content 'C:\\testdriver\\sandbox-agent\\package.json' }",
    "Write-Host 'Stopping existing runner processes...'",
    "Stop-ScheduledTask -TaskName RunTestDriverAgent -ErrorAction SilentlyContinue",
    "Stop-Process -Name node -Force -ErrorAction SilentlyContinue",
    "Start-Sleep -Seconds 2",
    "Write-Host 'Current runner version:'",
    "Get-Content 'C:\\testdriver\\sandbox-agent\\package.json' | ConvertFrom-Json | Select-Object -ExpandProperty version",
    "Set-Location 'C:\\testdriver\\sandbox-agent'",
    "Write-Host 'Dev mode: downloading runner from S3...'",
    "$tarball = 'C:\\Windows\\Temp\\runner-dev.tgz'",
PARAMS_EOF
  
  # Add the URL line with proper JSON escaping
  echo "    \"Invoke-WebRequest -Uri '$(echo "$DOWNLOAD_URL" | sed 's/"/\\"/g')' -OutFile \$tarball\"," >> "$PARAMS_FILE"
  
  cat >> "$PARAMS_FILE" << 'PARAMS_EOF'
    "Write-Host 'Downloaded tarball size:'",
    "(Get-Item $tarball).Length",
    "Write-Host 'Extracting runner...'",
    "tar -xzf $tarball -C 'C:\\Windows\\Temp'",
    "Write-Host 'Extracted package contents:'",
    "Get-ChildItem 'C:\\Windows\\Temp\\package' -Recurse | Select-Object FullName",
    "Write-Host 'New runner version in package:'",
    "Get-Content 'C:\\Windows\\Temp\\package\\package.json' | ConvertFrom-Json | Select-Object -ExpandProperty version",
    "Write-Host 'Clearing old lib folder...'",
    "Remove-Item 'C:\\testdriver\\sandbox-agent\\lib' -Recurse -Force -ErrorAction SilentlyContinue",
    "Write-Host 'Copying files to sandbox-agent...'",
    "xcopy 'C:\\Windows\\Temp\\package\\*' 'C:\\testdriver\\sandbox-agent\\' /E /Y /I",
    "Write-Host 'Files after copy:'",
    "Get-ChildItem 'C:\\testdriver\\sandbox-agent' | Select-Object Name",
    "Remove-Item 'C:\\Windows\\Temp\\package' -Recurse -Force -ErrorAction SilentlyContinue",
    "Remove-Item $tarball -Force -ErrorAction SilentlyContinue",
    "Write-Host 'Runner version after copy:'",
    "Get-Content 'C:\\testdriver\\sandbox-agent\\package.json' | ConvertFrom-Json | Select-Object -ExpandProperty version",
    "Write-Host 'Installing npm dependencies...'",
    "npm install --omit=dev 2>&1 | Write-Host",
    "Write-Host 'Final verification - ably-service.js exists:'",
    "Test-Path 'C:\\testdriver\\sandbox-agent\\lib\\ably-service.js'",
    "Write-Host 'Ensuring scheduled task exists...'",
    "if (-not (Get-ScheduledTask -TaskName RunTestDriverAgent -ErrorAction SilentlyContinue)) { $agentScript = if (Test-Path 'C:\\testdriver\\sandbox-agent\\sandbox-agent.js') { 'sandbox-agent.js' } else { 'node_modules/@testdriverai/runner/sandbox-agent.js' }; @(\"Set-Location 'C:\\testdriver\\sandbox-agent'\", \"while (`$true) { & node $agentScript 2>&1 | Tee-Object -Append -FilePath C:\\testdriver\\logs\\sandbox-agent.log; Start-Sleep -Seconds 2 }\") | Set-Content 'C:\\testdriver\\run_testdriver.ps1'; $a = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File C:\\testdriver\\run_testdriver.ps1'; $t = New-ScheduledTaskTrigger -AtLogOn -User 'testdriver'; $p = New-ScheduledTaskPrincipal -UserId 'testdriver' -RunLevel Highest; $s = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -StartWhenAvailable; Register-ScheduledTask -TaskName RunTestDriverAgent -Action $a -Trigger $t -Principal $p -Settings $s -Force }",
    "Write-Host 'Restarting RunTestDriverAgent scheduled task...'",
    "Start-ScheduledTask -TaskName RunTestDriverAgent -ErrorAction SilentlyContinue",
    "Write-Host '=== Runner install complete (dev) ==='"
  ]
}
PARAMS_EOF

  echo "Sending SSM command to download and install runner from S3..."
  INSTALL_CMD=$(aws ssm send-command \
    --region "$AWS_REGION" \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunPowerShellScript" \
    --parameters "file://$PARAMS_FILE" \
    --timeout-seconds 180 \
    --output json)
  rm -f "$PARAMS_FILE"
else
  echo "Installing @testdriverai/runner@${RUNNER_VERSION} via npm pack + extract..."

  # Build SSM parameters JSON in a temp file (same approach as dev mode)
  PARAMS_FILE=$(mktemp)
  cat > "$PARAMS_FILE" << PARAMS_EOF
{
  "commands": [
    "Write-Host '=== Starting runner install (npm pack) ==='",
    "Write-Host 'Bootstrapping sandbox-agent directory...'",
    "New-Item -ItemType Directory -Path 'C:\\\\testdriver\\\\sandbox-agent' -Force | Out-Null",
    "New-Item -ItemType Directory -Path 'C:\\\\testdriver\\\\logs' -Force | Out-Null",
    "if (-not (Test-Path 'C:\\\\testdriver\\\\sandbox-agent\\\\package.json')) { '{\"name\":\"td-sandbox\",\"private\":true}' | Set-Content 'C:\\\\testdriver\\\\sandbox-agent\\\\package.json' }",
    "Write-Host 'Stopping existing runner processes...'",
    "Stop-ScheduledTask -TaskName RunTestDriverAgent -ErrorAction SilentlyContinue",
    "Stop-Process -Name node -Force -ErrorAction SilentlyContinue",
    "Start-Sleep -Seconds 2",
    "Write-Host 'Current runner version:'",
    "Get-Content 'C:\\\\testdriver\\\\sandbox-agent\\\\package.json' | ConvertFrom-Json | Select-Object -ExpandProperty version",
    "Set-Location 'C:\\\\Windows\\\\Temp'",
    "Write-Host 'Downloading @testdriverai/runner@${RUNNER_VERSION} via npm pack...'",
    "npm pack @testdriverai/runner@${RUNNER_VERSION} 2>&1 | Write-Host",
    "\$tarball = (Get-ChildItem 'C:\\\\Windows\\\\Temp\\\\testdriverai-runner-*.tgz' | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName",
    "Write-Host \"Downloaded tarball: \$tarball\"",
    "Write-Host 'Extracting runner...'",
    "tar -xzf \$tarball -C 'C:\\\\Windows\\\\Temp'",
    "Write-Host 'New runner version in package:'",
    "Get-Content 'C:\\\\Windows\\\\Temp\\\\package\\\\package.json' | ConvertFrom-Json | Select-Object -ExpandProperty version",
    "Write-Host 'Clearing old lib folder...'",
    "Remove-Item 'C:\\\\testdriver\\\\sandbox-agent\\\\lib' -Recurse -Force -ErrorAction SilentlyContinue",
    "Write-Host 'Copying files to sandbox-agent...'",
    "xcopy 'C:\\\\Windows\\\\Temp\\\\package\\\\*' 'C:\\\\testdriver\\\\sandbox-agent\\\\' /E /Y /I",
    "Write-Host 'Runner version after copy:'",
    "Get-Content 'C:\\\\testdriver\\\\sandbox-agent\\\\package.json' | ConvertFrom-Json | Select-Object -ExpandProperty version",
    "Remove-Item 'C:\\\\Windows\\\\Temp\\\\package' -Recurse -Force -ErrorAction SilentlyContinue",
    "Remove-Item \$tarball -Force -ErrorAction SilentlyContinue",
    "Set-Location 'C:\\\\testdriver\\\\sandbox-agent'",
    "Write-Host 'Installing npm dependencies...'",
    "npm install --omit=dev 2>&1 | Write-Host",
    "Write-Host 'Ensuring scheduled task exists...'",
    "if (-not (Get-ScheduledTask -TaskName RunTestDriverAgent -ErrorAction SilentlyContinue)) { \$agentScript = if (Test-Path 'C:\\\\testdriver\\\\sandbox-agent\\\\sandbox-agent.js') { 'sandbox-agent.js' } else { 'node_modules/@testdriverai/runner/sandbox-agent.js' }; @(\"Set-Location 'C:\\\\testdriver\\\\sandbox-agent'\", \"while (`\$true) { & node \$agentScript 2>&1 | Tee-Object -Append -FilePath C:\\\\testdriver\\\\logs\\\\sandbox-agent.log; Start-Sleep -Seconds 2 }\") | Set-Content 'C:\\\\testdriver\\\\run_testdriver.ps1'; \$a = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File C:\\\\testdriver\\\\run_testdriver.ps1'; \$t = New-ScheduledTaskTrigger -AtLogOn -User 'testdriver'; \$p = New-ScheduledTaskPrincipal -UserId 'testdriver' -RunLevel Highest; \$s = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -StartWhenAvailable; Register-ScheduledTask -TaskName RunTestDriverAgent -Action \$a -Trigger \$t -Principal \$p -Settings \$s -Force }",
    "Write-Host 'Restarting RunTestDriverAgent scheduled task...'",
    "Start-ScheduledTask -TaskName RunTestDriverAgent -ErrorAction SilentlyContinue",
    "Write-Host '=== Runner install complete (npm pack) ==='"
  ]
}
PARAMS_EOF

  INSTALL_CMD=$(aws ssm send-command \
    --region "$AWS_REGION" \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunPowerShellScript" \
    --parameters "file://$PARAMS_FILE" \
    --timeout-seconds 180 \
    --output json)
  rm -f "$PARAMS_FILE"
fi

INSTALL_CMD_ID=$(jq -r '.Command.CommandId' <<<"$INSTALL_CMD")
echo "Runner install command sent (Command ID: $INSTALL_CMD_ID)"

# Wait for install to complete
echo "Waiting for runner install to complete..."
if aws ssm wait command-executed --region "$AWS_REGION" --command-id "$INSTALL_CMD_ID" --instance-id "$INSTANCE_ID" 2>/dev/null; then
  echo "✓ Runner install succeeded"
else
  INSTALL_STATUS=$(aws ssm get-command-invocation \
    --region "$AWS_REGION" \
    --command-id "$INSTALL_CMD_ID" \
    --instance-id "$INSTANCE_ID" \
    --output json 2>/dev/null || echo '{}')
  echo "⚠ Runner install status: $(jq -r '.Status // "Unknown"' <<<"$INSTALL_STATUS")"
  echo "Output: $(jq -r '.StandardOutputContent // "No output"' <<<"$INSTALL_STATUS" | head -20)"
  echo "Errors: $(jq -r '.StandardErrorContent // "No errors"' <<<"$INSTALL_STATUS" | head -10)"
fi

echo "Getting Public IP..."

# --- 5) Get instance Public IP ---
DESC_JSON=$(aws ec2 describe-instances --region "$AWS_REGION" --instance-ids "$INSTANCE_ID" --output json)
PUBLIC_IP=$(jq -r '.Reservations[0].Instances[0].PublicIpAddress // empty' <<<"$DESC_JSON")
[ -n "$PUBLIC_IP" ] || PUBLIC_IP="No public IP assigned"

# --- 6) Output results ---
echo "Setup complete!"
echo "PUBLIC_IP=$PUBLIC_IP"
echo "INSTANCE_ID=$INSTANCE_ID"
echo "AWS_REGION=$AWS_REGION"
