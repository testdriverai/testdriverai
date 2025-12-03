#!/bin/bash

# Example script showing how to run tests with TestDriver + Dashcam integration
# This script demonstrates the complete flow:
# 1. Start dashcam
# 2. Run tests with Vitest reporter
# 3. Stop and publish dashcam recording
# 4. View results in TestDriver dashboard

set -e

echo "======================================"
echo "TestDriver + Dashcam Test Recording"
echo "======================================"
echo ""

# Check for required environment variables
if [ -z "$TD_API_KEY" ]; then
  echo "Error: TD_API_KEY environment variable is required"
  echo "Get your API key from: https://console.testdriver.ai/settings/api-keys"
  exit 1
fi

if [ -z "$DASHCAM_PROJECT_ID" ]; then
  echo "Warning: DASHCAM_PROJECT_ID not set, replays won't be published"
fi

# Start Dashcam recording
echo "📹 Starting Dashcam..."
dashcam start

# Track test logs
echo "📝 Tracking test output..."
dashcam track --name="TestDriver Tests" --type=application --pattern="*.log"

echo ""

# Run tests with Vitest and TestDriver reporter
echo "🧪 Running tests..."
npx vitest run --config vitest.config.example.js

# Capture exit code
TEST_EXIT_CODE=$?

# Stop dashcam
echo ""
echo "🛑 Stopping Dashcam..."
dashcam stop

# Publish to dashcam project if configured
if [ -n "$DASHCAM_PROJECT_ID" ]; then
  echo "📤 Publishing replay to project: $DASHCAM_PROJECT_ID"
  REPLAY_URL=$(dashcam publish -p "$DASHCAM_PROJECT_ID" --json | jq -r '.replayUrl')
  echo "✅ Replay URL: $REPLAY_URL"
  echo ""
  echo "View your test recording at:"
  echo "$REPLAY_URL"
else
  echo "⚠️  Skipping publish (DASHCAM_PROJECT_ID not set)"
fi

echo ""
echo "======================================"
echo "📊 View Results"
echo "======================================"
echo "Dashboard: https://console.testdriver.ai/dashboard/test-runs"
echo ""

# Exit with the same code as tests
exit $TEST_EXIT_CODE
