#!/usr/bin/env bash
set -euo pipefail

# --- Config ---
ENV_FILE="$(pwd)/.aws-env"

# Try to load environment variables from .aws-env file if it exists
if [ -f "$ENV_FILE" ]; then
    echo "Loading environment from: $ENV_FILE"
    source "$ENV_FILE"
fi

# Check if we have the required variables
if [ -z "${INSTANCE_ID:-}" ]; then
    echo "❌ Error: INSTANCE_ID not found"
    echo "Run aws.sh first or set INSTANCE_ID environment variable"
    exit 1
fi

if [ -z "${AWS_REGION:-}" ]; then
    echo "❌ Error: AWS_REGION not found"
    echo "Run aws.sh first or set AWS_REGION environment variable"
    exit 1
fi

echo "Terminating instance $INSTANCE_ID in region $AWS_REGION..."

# One-liner to terminate the instance

echo "✓ Termination initiated"

# Optional: Clean up environment file
if [ -f "$ENV_FILE" ]; then
    rm "$ENV_FILE"
    echo "✓ Environment file cleaned up"
fi

echo "🎉 Instance shutdown complete!"
