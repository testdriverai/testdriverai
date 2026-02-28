#!/bin/bash
# E2B Test Runner
#
# Creates an E2B sandbox, starts the testdriver-runner inside it,
# then runs vitest tests against it.
#
# Usage:
#   ./scripts/e2b-test.sh [test-file]
#   ./scripts/e2b-test.sh examples/exec-only.test.mjs
#   ./scripts/e2b-test.sh  # runs all examples
#
# Required env vars:
#   E2B_API_KEY  — E2B API key
#   TD_API_KEY   — TestDriver API key
#
# Optional env vars:
#   E2B_TEMPLATE    — template name (default: testdriver-runner-dev)
#   TD_API_ROOT     — API root URL (default: https://api.testdriver.ai)

set -eo pipefail

TEMPLATE="${E2B_TEMPLATE:-testdriver-runner-dev}"
API_ROOT="${TD_API_ROOT:-https://api.testdriver.ai}"
TEST_FILE="${1:-examples/*.test.mjs}"
SANDBOX_ID=""

# Ensure required env vars
if [[ -z "${E2B_API_KEY:-}" ]]; then
  echo "Error: E2B_API_KEY is required"
  exit 1
fi
if [[ -z "${TD_API_KEY:-}" ]]; then
  echo "Error: TD_API_KEY is required"
  exit 1
fi

cleanup() {
  if [[ -n "$SANDBOX_ID" ]]; then
    echo "[e2b-test] Killing sandbox $SANDBOX_ID..."
    e2b sandbox kill "$SANDBOX_ID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Step 1: Create sandbox (detached)
echo "[e2b-test] Creating E2B sandbox from template: $TEMPLATE"
CREATE_OUTPUT=$(e2b sandbox create "$TEMPLATE" --detach 2>&1)
echo "$CREATE_OUTPUT"
SANDBOX_ID=$(echo "$CREATE_OUTPUT" | grep "Sandbox created with ID" | grep -oE '[a-z0-9]{10,}' | head -1)

if [[ -z "$SANDBOX_ID" ]]; then
  echo "Error: Failed to create sandbox"
  exit 1
fi
echo "[e2b-test] Sandbox created: $SANDBOX_ID"

# Step 2: Write .env file for the runner (need -u root for /opt permissions)
echo "[e2b-test] Writing .env to sandbox..."
e2b sandbox exec "$SANDBOX_ID" -u root -- bash -c "echo 'TD_API_KEY=$TD_API_KEY
API_ROOT=$API_ROOT
TD_API_ROOT=$API_ROOT' > /opt/testdriver-runner/.env"

# Step 3: Start runner in background using -b flag (with log redirect)
echo "[e2b-test] Starting runner inside sandbox..."
RUNNER_PID=$(e2b sandbox exec "$SANDBOX_ID" -u root -c /opt/testdriver-runner --background -- bash -c 'node index.js > /tmp/runner.log 2>&1' 2>&1)
echo "[e2b-test] Runner started with PID: $RUNNER_PID"

# Step 4: Poll until runner registers with Ably (check log for "ready")
echo "[e2b-test] Waiting for runner to register..."
MAX_WAIT=90
ELAPSED=0
while [[ $ELAPSED -lt $MAX_WAIT ]]; do
  LOG=$(e2b sandbox exec "$SANDBOX_ID" -u root -- cat /tmp/runner.log 2>/dev/null || true)
  if echo "$LOG" | grep -q "Runner ready"; then
    echo "[e2b-test] ✓ Runner registered with Ably"
    break
  fi
  sleep 3
  ELAPSED=$((ELAPSED + 3))
  echo "[e2b-test]   ...waiting ($ELAPSED/${MAX_WAIT}s)"
done

if [[ $ELAPSED -ge $MAX_WAIT ]]; then
  echo "[e2b-test] Error: Runner failed to register. Logs:"
  e2b sandbox exec "$SANDBOX_ID" -u root -- cat /tmp/runner.log 2>/dev/null || true
  exit 1
fi

# Show runner logs
echo "[e2b-test] Runner log:"
e2b sandbox exec "$SANDBOX_ID" -u root -- cat /tmp/runner.log 2>/dev/null || true
echo ""

# Step 5: Run vitest
echo "[e2b-test] Running: vitest run $TEST_FILE --reporter=dot"
TD_API_KEY="$TD_API_KEY" TD_API_ROOT="$API_ROOT" \
  npx vitest run $TEST_FILE --reporter=dot

echo "[e2b-test] Done!"
