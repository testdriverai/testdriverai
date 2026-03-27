#!/usr/bin/env bash
set -euo pipefail

# Usage: ./install-dev-runner.sh <instance-id>
INSTANCE_ID="${1:?Usage: $0 <instance-id>}"
AWS_REGION="${AWS_REGION:-us-east-2}"

RUNNER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../runner" && pwd)"

echo "Packing local runner..."
TMPDIR=$(mktemp -d)
pushd "$RUNNER_DIR" > /dev/null
npm pack --pack-destination "$TMPDIR" > /dev/null 2>&1
TARBALL=$(ls "$TMPDIR"/*.tgz)
popd > /dev/null
echo "Tarball: $TARBALL"

echo "Uploading to S3..."
S3_KEY="runner-dev/$(date +%s)-$(openssl rand -hex 4)/runner.tgz"
aws s3 cp "$TARBALL" "s3://v7-transfer/${S3_KEY}" --region "$AWS_REGION" > /dev/null
DOWNLOAD_URL=$(aws s3 presign "s3://v7-transfer/${S3_KEY}" --expires-in 900 --region "$AWS_REGION")
rm -rf "$TMPDIR"

echo "Creating SSM params file..."

# Write Python script to temp file to generate valid JSON
PYTHON_SCRIPT=$(mktemp --suffix=.py)
cat > "$PYTHON_SCRIPT" << 'PYEOF'
import json
import sys

url = sys.argv[1]

commands = [
    "Write-Host '=== Stopping runner ==='",
    "New-Item -ItemType Directory -Path 'C:\\testdriver\\sandbox-agent' -Force | Out-Null",
    "New-Item -ItemType Directory -Path 'C:\\testdriver\\logs' -Force | Out-Null",
    "if (-not (Test-Path 'C:\\testdriver\\sandbox-agent\\package.json')) { '{\"name\":\"td-sandbox\",\"private\":true}' | Set-Content 'C:\\testdriver\\sandbox-agent\\package.json' }",
    "Stop-ScheduledTask -TaskName RunTestDriverAgent -ErrorAction SilentlyContinue",
    "Stop-Process -Name node -Force -ErrorAction SilentlyContinue", 
    "Start-Sleep -Seconds 2",
    "Set-Location 'C:\\testdriver\\sandbox-agent'",
    "$tarball = 'C:\\Windows\\Temp\\runner-dev.tgz'",
    f"Invoke-WebRequest -Uri '{url}' -OutFile $tarball",
    "Write-Host 'Tarball size:'; (Get-Item $tarball).Length",
    "Remove-Item -Path lib -Recurse -Force -ErrorAction SilentlyContinue", 
    "tar -xzf $tarball --strip-components=1 -C .",
    "Get-Content 'package.json' | ConvertFrom-Json | Select-Object -ExpandProperty version",
    "Write-Host '=== Ensuring scheduled task exists ==='",
    "if (-not (Get-ScheduledTask -TaskName RunTestDriverAgent -ErrorAction SilentlyContinue)) { $agentScript = if (Test-Path 'sandbox-agent.js') { 'sandbox-agent.js' } else { 'node_modules/@testdriverai/runner/sandbox-agent.js' }; @(\"Set-Location 'C:\\testdriver\\sandbox-agent'\", \"while (`$true) { & node $agentScript 2>&1 | Tee-Object -Append -FilePath C:\\testdriver\\logs\\sandbox-agent.log; Start-Sleep -Seconds 2 }\") | Set-Content 'C:\\testdriver\\run_testdriver.ps1'; $a = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File C:\\testdriver\\run_testdriver.ps1'; $t = New-ScheduledTaskTrigger -AtLogOn -User 'testdriver'; $p = New-ScheduledTaskPrincipal -UserId 'testdriver' -RunLevel Highest; $s = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -StartWhenAvailable; Register-ScheduledTask -TaskName RunTestDriverAgent -Action $a -Trigger $t -Principal $p -Settings $s -Force }",
    "Write-Host '=== Starting runner ==='",
    "Start-ScheduledTask -TaskName RunTestDriverAgent -ErrorAction SilentlyContinue",
    "Start-Sleep -Seconds 3",
    "Get-Content 'C:\\testdriver\\log.txt' -Tail 20 -ErrorAction SilentlyContinue"
]

params = {"commands": commands}
print(json.dumps(params))
PYEOF

python3 "$PYTHON_SCRIPT" "$DOWNLOAD_URL" > /tmp/ssm-install-params.json
rm "$PYTHON_SCRIPT"

echo "Sending SSM command..."
CMD_JSON=$(aws ssm send-command \
  --region "$AWS_REGION" \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunPowerShellScript" \
  --parameters "file:///tmp/ssm-install-params.json" \
  --output json)

COMMAND_ID=$(echo "$CMD_JSON" | jq -r '.Command.CommandId')
echo "Command ID: $COMMAND_ID"

echo "Waiting for completion..."
aws ssm wait command-executed --region "$AWS_REGION" --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" || true

echo "Getting output..."
aws ssm get-command-invocation \
  --region "$AWS_REGION" \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --query 'StandardOutputContent' \
  --output text
