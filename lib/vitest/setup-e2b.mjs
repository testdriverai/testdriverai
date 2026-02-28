/**
 * Vitest Setup File for E2B Sandbox Instances
 *
 * This setup file spawns a fresh E2B sandbox before each test
 * and kills it after each test completes. The sandbox runs the
 * testdriver-runner entrypoint which registers as an Ably presence
 * runner, allowing the SDK to discover and claim it automatically.
 *
 * Usage in vitest.config.mjs:
 * ```js
 * export default defineConfig({
 *   test: {
 *     setupFiles: [
 *       'testdriverai/vitest/setup',
 *       'testdriverai/vitest/setup-e2b'
 *     ],
 *   },
 * });
 * ```
 *
 * Required environment variables:
 * - E2B_API_KEY      — E2B API key for sandbox creation
 * - TD_API_KEY       — TestDriver API key (passed to sandbox for runner registration)
 *
 * Optional environment variables:
 * - E2B_TEMPLATE     — E2B template name or ID (default: "testdriver-runner-dev")
 * - TD_API_ROOT      — TestDriver API URL (passed to sandbox, default: https://api.testdriver.ai)
 * - E2B_TIMEOUT_MS   — Sandbox timeout in ms (default: 600000 = 10 min)
 */

import { beforeEach } from "vitest";

// Lazy-load E2B SDK (devDependency, may not always be installed)
let Sandbox;
async function loadE2B() {
  if (!Sandbox) {
    // Use the ESM entry point explicitly to avoid CJS/ESM chalk compatibility issues
    const e2b = await import("e2b/dist/index.mjs");
    Sandbox = e2b.Sandbox;
  }
  return Sandbox;
}

// Store sandbox info per test
const testSandboxes = new Map();

// Global object to share sandbox termination callbacks with hooks.mjs
globalThis.__testdriverE2B = globalThis.__testdriverE2B || {
  sandboxes: testSandboxes,
  /**
   * Kill the E2B sandbox for a given test ID.
   * Called by hooks.mjs after dashcam.stop() completes.
   */
  async killSandbox(testId) {
    const sandboxInfo = testSandboxes.get(testId);
    if (!sandboxInfo) {
      return; // No sandbox was spawned for this test
    }

    const { sandbox, sandboxId } = sandboxInfo;

    console.log(`[TestDriver] Killing E2B sandbox: ${sandboxId}`);

    try {
      await sandbox.kill();
      console.log(`[TestDriver] E2B sandbox killed: ${sandboxId}`);
    } catch (error) {
      console.error(
        "[TestDriver] Failed to kill E2B sandbox:",
        error.message,
      );
      // Don't throw - we don't want to fail the test because of cleanup issues
    } finally {
      testSandboxes.delete(testId);
    }
  },
};

/**
 * Cleanup function to kill all running sandboxes.
 * Called on process exit to ensure no orphaned sandboxes.
 */
function cleanupAllSandboxes() {
  if (testSandboxes.size === 0) {
    return;
  }

  console.log(
    `[TestDriver] Emergency cleanup: killing ${testSandboxes.size} E2B sandbox(es)`,
  );

  // Use SandboxApi.kill for synchronous-ish cleanup on exit
  for (const [, sandboxInfo] of testSandboxes.entries()) {
    const { sandbox, sandboxId } = sandboxInfo;

    try {
      console.log(`[TestDriver] Killing E2B sandbox: ${sandboxId}`);
      // sandbox.kill() is async, but we try our best on process exit
      sandbox.kill().catch(() => {});
    } catch (error) {
      console.error(
        `[TestDriver] Failed to kill E2B sandbox ${sandboxId}:`,
        error.message,
      );
    }
  }

  testSandboxes.clear();
}

// Register cleanup handlers for various exit scenarios
process.on("exit", cleanupAllSandboxes);
process.on("SIGINT", () => {
  cleanupAllSandboxes();
});
process.on("SIGTERM", () => {
  cleanupAllSandboxes();
});
process.on("uncaughtException", (error) => {
  console.error("[TestDriver] Uncaught exception:", error);
  cleanupAllSandboxes();
});

/**
 * Ensure the desktop environment (Xvfb, x11vnc, noVNC) is running.
 * The start_cmd in e2b.toml runs start-desktop.sh which starts these
 * services at boot, but we verify they're up and restart if needed.
 */
async function ensureDesktop(sandbox) {
  console.log("[TestDriver] Verifying desktop services...");

  try {
    // Check if Xvfb is running
    const xvfbResult = await sandbox.commands.exec(
      "pgrep -x Xvfb || echo 'NOT_RUNNING'",
      { timeoutMs: 5_000 },
    );

    if (xvfbResult.stdout.includes("NOT_RUNNING")) {
      console.log("[TestDriver] Xvfb not running, starting desktop...");
      await sandbox.commands.exec(
        "DISPLAY=:0 /home/user/scripts/start-desktop.sh &",
        { timeoutMs: 10_000 },
      ).catch(() => {});
      // Give desktop services time to start
      await new Promise((resolve) => setTimeout(resolve, 8_000));
    }

    // Check if noVNC is running on port 6080
    const novncResult = await sandbox.commands.exec(
      "pgrep -f 'novnc_proxy' || pgrep -f 'websockify' || echo 'NOT_RUNNING'",
      { timeoutMs: 5_000 },
    );

    if (novncResult.stdout.includes("NOT_RUNNING")) {
      console.log("[TestDriver] noVNC not running, starting...");
      // Ensure x11vnc is running first
      await sandbox.commands.exec(
        "pgrep x11vnc || x11vnc -display :0 -forever -nopw -shared -rfbport 5900 -bg -o /dev/null 2>/dev/null",
        { timeoutMs: 5_000 },
      ).catch(() => {});
      // Start noVNC
      await sandbox.commands.exec(
        "nohup /opt/noVNC/utils/novnc_proxy --vnc localhost:5900 --listen 6080 > /dev/null 2>&1 &",
        { timeoutMs: 5_000 },
      ).catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }

    // Verify noVNC is now accessible
    const verifyResult = await sandbox.commands.exec(
      "curl -s -o /dev/null -w '%{http_code}' http://localhost:6080/ 2>/dev/null || echo '000'",
      { timeoutMs: 5_000 },
    );
    const httpCode = verifyResult.stdout.trim();
    if (httpCode === "200" || httpCode === "301" || httpCode === "302") {
      console.log("[TestDriver] ✓ noVNC is accessible on port 6080");
    } else {
      console.warn(`[TestDriver] ⚠ noVNC returned HTTP ${httpCode} — preview may not work`);
    }
  } catch (error) {
    console.warn("[TestDriver] ⚠ Could not verify desktop services:", error.message);
  }
}

/**
 * Write .env file and start the runner inside the sandbox.
 *
 * The E2B sandbox `envs` option only applies to sandbox.commands.exec() calls,
 * NOT to the start command (entrypoint). The runner reads TD_API_KEY from env
 * and exits immediately if it's missing. So we:
 *   1. Write a .env file to /opt/testdriver-runner/.env
 *   2. Kill any failed runner process from the entrypoint
 *   3. Start the runner in the background with proper env vars
 *   4. Poll until the runner process is detected
 */
async function startRunner(sandbox, envVars, maxWaitMs = 90_000) {
  const startTime = Date.now();
  const pollIntervalMs = 3_000;

  // Step 1: Write .env file so runner's dotenv.config() picks it up
  const envFileContent = Object.entries(envVars)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  console.log("[TestDriver] Writing .env to sandbox...");
  await sandbox.files.write("/opt/testdriver-runner/.env", envFileContent);

  // Step 2: Kill any existing (failed) runner process from entrypoint
  try {
    await sandbox.commands.exec("pkill -f testdriver-runner 2>/dev/null; sleep 1", {
      timeoutMs: 10_000,
    });
  } catch {
    // May not be running — that's fine
  }

  // Step 3: Start the runner in background with DISPLAY set for GUI automation
  console.log("[TestDriver] Starting runner inside sandbox...");
  try {
    await sandbox.commands.exec(
      "cd /opt/testdriver-runner && DISPLAY=:0 nohup node index.js > /tmp/testdriver-runner.log 2>&1 &",
      { timeoutMs: 10_000 },
    );
  } catch {
    // exec returns after the foreground part; nohup puts it in background
  }

  // Step 4: Poll until runner process is detected
  console.log("[TestDriver] Waiting for runner to register...");

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const result = await sandbox.commands.exec(
        "pgrep -f 'node index.js' || pgrep -f testdriver-runner",
        { timeoutMs: 5_000 },
      );

      if (result.exitCode === 0 && result.stdout.trim()) {
        console.log("[TestDriver] ✓ Runner process detected inside sandbox");

        // Give the runner a moment to register with Ably
        await new Promise((resolve) => setTimeout(resolve, 5_000));

        // Print runner log tail for debugging
        try {
          const logResult = await sandbox.commands.exec(
            "tail -20 /tmp/testdriver-runner.log 2>/dev/null",
            { timeoutMs: 5_000 },
          );
          if (logResult.stdout.trim()) {
            console.log("[TestDriver] Runner log:\n" + logResult.stdout.trim());
          }
        } catch {
          // Ignore log read failures
        }

        return true;
      }
    } catch {
      // Command may fail if sandbox is still starting
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  // Print runner logs for debugging if we timed out
  try {
    const logResult = await sandbox.commands.exec(
      "cat /tmp/testdriver-runner.log 2>/dev/null",
      { timeoutMs: 5_000 },
    );
    if (logResult.stdout.trim()) {
      console.error("[TestDriver] Runner log (timeout debug):\n" + logResult.stdout.trim());
    }
  } catch {
    // Ignore
  }

  console.warn(
    `[TestDriver] ⚠ Runner process not detected after ${maxWaitMs / 1000}s — proceeding anyway (SDK will retry)`,
  );
  return false;
}

beforeEach(async (context) => {
  // Only spawn E2B sandboxes when E2B_TEMPLATE is set
  const template = process.env.E2B_TEMPLATE;
  if (!template) {
    return;
  }

  // Verify required environment variables
  if (!process.env.E2B_API_KEY) {
    throw new Error(
      "[TestDriver] E2B_TEMPLATE is set but E2B_API_KEY is missing. " +
      "Get your E2B API key at: https://e2b.dev/dashboard",
    );
  }

  if (!process.env.TD_API_KEY) {
    throw new Error(
      "[TestDriver] TD_API_KEY is required for E2B runner registration. " +
      "Get your API key at: https://console.testdriver.ai/team",
    );
  }

  const testId = context.task.id;
  const timeoutMs = parseInt(process.env.E2B_TIMEOUT_MS || "600000", 10);
  const apiRoot = process.env.TD_API_ROOT || "https://api.testdriver.ai";

  console.log(
    `[TestDriver] Spawning E2B sandbox for test: ${context.task.name}`,
  );
  console.log(`[TestDriver]   Template: ${template}`);
  console.log(`[TestDriver]   Timeout: ${timeoutMs / 1000}s`);
  console.log(`[TestDriver]   API Root: ${apiRoot}`);

  try {
    const SandboxClass = await loadE2B();

    const sandbox = await SandboxClass.create(template, {
      timeoutMs,
      envs: {
        TD_API_KEY: process.env.TD_API_KEY,
        TD_API_ROOT: apiRoot,
        API_ROOT: apiRoot,
      },
    });

    const sandboxId = sandbox.sandboxId;

    console.log(`[TestDriver] E2B sandbox created: ${sandboxId}`);

    // Store sandbox info for cleanup
    testSandboxes.set(testId, { sandbox, sandboxId, template });

    // Ensure desktop environment (Xvfb, x11vnc, noVNC) is running
    await ensureDesktop(sandbox);

    // Construct the public VNC URL for this sandbox (E2B port forwarding pattern)
    const vncUrl = `https://6080-${sandboxId}.e2b.dev/vnc_lite.html`;

    // Start the runner inside the sandbox
    await startRunner(sandbox, {
      TD_API_KEY: process.env.TD_API_KEY,
      TD_API_ROOT: apiRoot,
      API_ROOT: apiRoot,
      TD_VNC_URL: vncUrl,
    });

    console.log(`[TestDriver] ✅ E2B sandbox ready: ${sandboxId}`);

    // Store sandbox ID on context so tests can access it if needed
    context.e2bSandboxId = sandboxId;

    // Get the noVNC URL for debugging (port 6080)
    try {
      const vncHost = sandbox.getHost(6080);
      console.log(`[TestDriver]   VNC: https://${vncHost}`);
    } catch {
      // VNC may not be available
    }
  } catch (error) {
    console.error(
      "[TestDriver] Failed to spawn E2B sandbox:",
      error.message,
    );
    throw error;
  }
});

// NOTE: No afterEach hook here!
// Sandbox killing is handled by hooks.mjs AFTER dashcam.stop() completes.
// This ensures dashcam can properly stop before the sandbox is killed.
