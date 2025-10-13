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
WS_CONFIG_PATH='C:\Windows\Temp\pyautogui-ws.json'

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

echo "Getting Public IP..."

# # --- 5) Get instance Public IP ---
DESC_JSON=$(aws ec2 describe-instances --region "$AWS_REGION" --instance-ids "$INSTANCE_ID" --output json)
PUBLIC_IP=$(jq -r '.Reservations[0].Instances[0].PublicIpAddress // empty' <<<"$DESC_JSON")
[ -n "$PUBLIC_IP" ] || PUBLIC_IP="No public IP assigned"

# echo "Getting Websocket Port..."


# --- 6) Read WebSocket config JSON ---
echo "Reading WebSocket configuration from: $WS_CONFIG_PATH"
READ_JSON=$(aws ssm send-command \
  --region "$AWS_REGION" \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunPowerShellScript" \
  --parameters "commands=[\"if (Test-Path '${WS_CONFIG_PATH}') { Get-Content -Raw '${WS_CONFIG_PATH}' } else { Write-Output 'Config file not found at ${WS_CONFIG_PATH}' }\"]" \
  --output json)

READ_CMD_ID=$(jq -r '.Command.CommandId' <<<"$READ_JSON")
echo "WebSocket config read command ID: $READ_CMD_ID"

echo "Waiting for WebSocket config command to complete..."
aws ssm wait command-executed --region "$AWS_REGION" --command-id "$READ_CMD_ID" --instance-id "$INSTANCE_ID"

INVOC=$(aws ssm get-command-invocation \
  --region "$AWS_REGION" \
  --command-id "$READ_CMD_ID" \
  --instance-id "$INSTANCE_ID" \
  --output json)

STDOUT=$(jq -r '.StandardOutputContent // ""' <<<"$INVOC")
STDERR=$(jq -r '.StandardErrorContent // ""' <<<"$INVOC")
CMD_STATUS=$(jq -r '.Status // ""' <<<"$INVOC")

echo "WebSocket config command status: $CMD_STATUS"
if [ -n "$STDERR" ] && [ "$STDERR" != "null" ]; then
  echo "WebSocket config stderr: $STDERR"
fi
echo "WebSocket config raw output: $STDOUT"

# --- 7) Output results ---
echo "Setup complete!"
echo "PUBLIC_IP=$PUBLIC_IP"
echo "INSTANCE_ID=$INSTANCE_ID"
echo "AWS_REGION=$AWS_REGION"
