#!/usr/bin/env bash
set -euo pipefail

# --- Disable Windows Defender ---
# This script disables Windows Defender on a running AWS instance via SSM.
# Requires: AWS_REGION, INSTANCE_ID environment variables

: "${AWS_REGION:?Set AWS_REGION}"
: "${INSTANCE_ID:?Set INSTANCE_ID}"

echo "Disabling Windows Defender..."
DEFENDER_CMD=$(aws ssm send-command \
  --region "$AWS_REGION" \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunPowerShellScript" \
  --parameters 'commands=["Set-MpPreference -DisableRealtimeMonitoring $true", "Set-MpPreference -DisableIOAVProtection $true", "Set-MpPreference -DisableBehaviorMonitoring $true", "Set-MpPreference -DisableBlockAtFirstSeen $true", "Set-MpPreference -DisableScriptScanning $true", "Write-Output \"Windows Defender disabled successfully\""]' \
  --output json)

DEFENDER_CMD_ID=$(jq -r '.Command.CommandId' <<<"$DEFENDER_CMD")
echo "Defender disable command ID: $DEFENDER_CMD_ID"

echo "Waiting for Defender disable command to complete..."
if aws ssm wait command-executed --region "$AWS_REGION" --command-id "$DEFENDER_CMD_ID" --instance-id "$INSTANCE_ID" 2>/dev/null; then
  DEFENDER_STATUS=$(aws ssm get-command-invocation \
    --region "$AWS_REGION" \
    --command-id "$DEFENDER_CMD_ID" \
    --instance-id "$INSTANCE_ID" \
    --output json)
  DEFENDER_OUTPUT=$(jq -r '.StandardOutputContent // ""' <<<"$DEFENDER_STATUS")
  DEFENDER_ERROR=$(jq -r '.StandardErrorContent // ""' <<<"$DEFENDER_STATUS")
  DEFENDER_CMD_STATUS=$(jq -r '.Status // ""' <<<"$DEFENDER_STATUS")
  
  echo "Defender disable status: $DEFENDER_CMD_STATUS"
  if [ -n "$DEFENDER_OUTPUT" ] && [ "$DEFENDER_OUTPUT" != "null" ]; then
    echo "✓ $DEFENDER_OUTPUT"
  fi
  if [ -n "$DEFENDER_ERROR" ] && [ "$DEFENDER_ERROR" != "null" ]; then
    echo "⚠ Defender stderr: $DEFENDER_ERROR"
  fi
else
  echo "⚠ Defender disable command may have timed out, continuing anyway..."
fi
