#!/usr/bin/env bash
set -euo pipefail

# ─── spawn-sandbox.sh ────────────────────────────────────────────────────────
# Launch an E2B sandbox from a TestDriver template.
#
# Equivalent to setup/aws/spawn-runner.sh but for E2B cloud sandboxes.
#
# Prerequisites:
#   - Node.js 18+
#   - E2B_API_KEY set in environment
#   - TD_API_KEY set in environment (passed to the sandbox runner)
#   - Template built via build-template.sh (or use E2B_TEMPLATE_ID)
#
# Usage:
#   ./spawn-sandbox.sh                        # uses default template
#   E2B_TEMPLATE_ID=abc123 ./spawn-sandbox.sh # uses specific template
#
# Environment variables:
#   E2B_API_KEY       — Required: your E2B API key
#   TD_API_KEY        — Required: TestDriver API key (for the runner)
#   E2B_TEMPLATE_ID   — Optional: template ID (default: testdriver-v7)
#   TD_API_ROOT       — Optional: TestDriver API URL
#   E2B_TIMEOUT_MS    — Optional: sandbox timeout in ms (default: 300000 = 5min)
#   SCREEN_WIDTH      — Optional: display width (default: 1366)
#   SCREEN_HEIGHT     — Optional: display height (default: 768)
# ─────────────────────────────────────────────────────────────────────────────

: "${E2B_API_KEY:?Set E2B_API_KEY — get yours at https://e2b.dev}"
: "${TD_API_KEY:?Set TD_API_KEY — get yours at https://console.testdriver.ai/team}"

TEMPLATE_ID="${E2B_TEMPLATE_ID:-testdriver-v7}"
TIMEOUT_MS="${E2B_TIMEOUT_MS:-300000}"
WIDTH="${SCREEN_WIDTH:-1366}"
HEIGHT="${SCREEN_HEIGHT:-768}"
API_ROOT="${TD_API_ROOT:-https://api.testdriver.ai}"

echo "╔═══════════════════════════════════════════════════╗"
echo "║  TestDriver — E2B Sandbox Launcher                ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""
echo "  Template:    $TEMPLATE_ID"
echo "  Timeout:     ${TIMEOUT_MS}ms"
echo "  Resolution:  ${WIDTH}x${HEIGHT}"
echo "  API Root:    $API_ROOT"
echo ""

# Use inline Node.js to launch the sandbox via E2B SDK
node --input-type=module <<SCRIPT
import { Sandbox } from '@e2b/desktop';

async function main() {
  console.log('Launching E2B sandbox...');

  const sandbox = await Sandbox.create('${TEMPLATE_ID}', {
    timeoutMs: ${TIMEOUT_MS},
    resolution: [${WIDTH}, ${HEIGHT}],
    envs: {
      TD_API_KEY: '${TD_API_KEY}',
      API_ROOT: '${API_ROOT}',
      SCREEN_WIDTH: '${WIDTH}',
      SCREEN_HEIGHT: '${HEIGHT}',
    },
  });

  console.log('');
  console.log('✓ Sandbox launched successfully!');
  console.log('');
  console.log('  Sandbox ID:  ' + sandbox.sandboxId);
  console.log('  VNC URL:     https://' + sandbox.getHost(6080));
  console.log('');

  // Wait for desktop to be ready (poll for xfce4-panel)
  console.log('Waiting for desktop to be ready...');
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      const result = await sandbox.commands.run('pgrep -x xfce4-panel', { timeoutMs: 5000 });
      if (result.exitCode === 0) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }

  if (ready) {
    console.log('✓ Desktop is ready');
  } else {
    console.log('⚠ Desktop readiness check timed out (sandbox may still be starting)');
  }

  // Verify runner is running
  console.log('Checking runner status...');
  try {
    const result = await sandbox.commands.run('pgrep -f testdriver-runner', { timeoutMs: 5000 });
    if (result.exitCode === 0) {
      console.log('✓ TestDriver runner is running');
    } else {
      console.log('⚠ Runner not detected — it may still be starting');
    }
  } catch {
    console.log('⚠ Could not check runner status');
  }

  console.log('');
  console.log('Sandbox is ready. Open the VNC URL to see the desktop.');
  console.log('The runner is registered and waiting for SDK sessions.');
  console.log('');
  console.log('To keep the sandbox alive, press Ctrl+C to exit (sandbox stays running).');
  console.log('To kill the sandbox:');
  console.log('  e2b sandbox kill ' + sandbox.sandboxId);

  // Keep the script alive so the sandbox stays running
  await new Promise(() => {});
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
SCRIPT
