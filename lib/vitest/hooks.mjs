/**
 * Vitest Hooks for TestDriver
 *
 * Provides lifecycle management for TestDriver in Vitest tests.
 *
 * @example
 * import { TestDriver } from 'testdriverai/vitest/hooks';
 *
 * test('my test', async (context) => {
 *   const testdriver = TestDriver(context, { headless: true });
 *
 *   await testdriver.provision.chrome({ url: 'https://example.com' });
 *   await testdriver.find('button').click();
 * });
 */

import chalk from "chalk";
import { createRequire } from "module";
import path from "path";

import TestDriverSDK from "../../sdk.js";

// Use createRequire to import CommonJS modules
const require = createRequire(import.meta.url);

/**
 * Minimum required Vitest major version
 */
const MINIMUM_VITEST_VERSION = 4;

/**
 * Check that Vitest version meets minimum requirements
 * @throws {Error} if Vitest version is below minimum or not installed
 */
function checkVitestVersion() {
  try {
    const vitestPkg = require("vitest/package.json");
    const version = vitestPkg.version;
    const major = parseInt(version.split(".")[0], 10);

    if (major < MINIMUM_VITEST_VERSION) {
      throw new Error(
        `TestDriver requires Vitest >= ${MINIMUM_VITEST_VERSION}.0.0, but found ${version}. ` +
          `Please upgrade Vitest: npm install vitest@latest`,
      );
    }
  } catch (err) {
    if (err.code === "MODULE_NOT_FOUND") {
      throw new Error(
        "TestDriver requires Vitest to be installed. " +
          "Please install it: npm install vitest@latest",
      );
    }
    throw err;
  }
}

// Check Vitest version at module load time
checkVitestVersion();

/**
 * Console log forwarding to sandbox dashcam streams.
 *
 * Previous implementation used vi.spyOn(console, ...) to intercept all console
 * output globally. This is NOT thread-safe under pool:"threads" because:
 * - `console` is shared across all worker threads
 * - Multiple threads calling vi.spyOn(console) simultaneously corrupts the spy chain
 * - One thread's mockRestore() can undo another thread's interception
 *
 * New approach: Instead of monkey-patching console, we wrap the SDK client's
 * log-forwarding at the per-client level. Each TestDriver instance has its own
 * `forwardConsoleLogs()` / `stopConsoleForwarding()` that uses a direct
 * console method wrapper stored on the instance itself — no shared mutable state.
 */

/**
 * Track which clients want console forwarding.
 * This Set is module-scoped (per-thread under threads pool, per-process under forks)
 * which is safe because we never mutate shared globals.
 * @type {Set<import('../../sdk.js').default>}
 */
const _forwardingClients = new Set();

const debugConsoleSpy = process.env.TD_DEBUG_CONSOLE_SPY === "true";

/**
 * Serialise console args to a single string for sandbox forwarding.
 */
function serialiseConsoleArgs(args) {
  return args
    .map((arg) => {
      if (typeof arg === "object" && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(" ");
}

/**
 * Forward a console message to a specific sandbox client.
 */
function forwardToSandbox(client, args) {
  if (!client.sandbox || !client.sandbox.instanceSocketConnected) return;

  const message = serialiseConsoleArgs(args);
  const encoded = Buffer.from(message, "utf8").toString("base64");

  try {
    client.sandbox.send({ type: "output", output: encoded });
  } catch {
    // fire-and-forget
  }
}

/**
 * Start forwarding console output to a TestDriver client's sandbox.
 * Uses a lightweight approach: wraps console methods with a forwarding layer
 * that is safely removable per-client without affecting other clients or threads.
 *
 * @param {import('../../sdk.js').default} client
 * @param {string} taskId - For debug logging
 */
function setupConsoleSpy(client, taskId) {
  if (debugConsoleSpy) {
    process.stdout.write(`[DEBUG setupConsoleSpy] registering taskId: ${taskId}\n`);
  }

  _forwardingClients.add(client);

  // If this is the first client, install the forwarding hooks.
  // We use a non-invasive approach: store original methods and set wrappers
  // that forward to all active clients. Unlike vi.spyOn, this doesn't create
  // mock metadata that could conflict across threads.
  if (_forwardingClients.size === 1) {
    // Only install if we haven't already (idempotent within this thread)
    if (!console.__tdOriginalLog) {
      console.__tdOriginalLog = console.log;
      console.__tdOriginalError = console.error;
      console.__tdOriginalWarn = console.warn;
      console.__tdOriginalInfo = console.info;

      const makeWrapper = (originalFn) => (...args) => {
        originalFn.apply(console, args);
        for (const c of _forwardingClients) {
          forwardToSandbox(c, args);
        }
      };

      console.log = makeWrapper(console.__tdOriginalLog);
      console.error = makeWrapper(console.__tdOriginalError);
      console.warn = makeWrapper(console.__tdOriginalWarn);
      console.info = makeWrapper(console.__tdOriginalInfo);
    }
  }
}

/**
 * Stop forwarding console output for a specific client.
 * When the last client is removed, restore original console methods.
 *
 * @param {import('../../sdk.js').default} client
 */
function cleanupConsoleSpy(client) {
  _forwardingClients.delete(client);

  if (_forwardingClients.size === 0 && console.__tdOriginalLog) {
    console.log = console.__tdOriginalLog;
    console.error = console.__tdOriginalError;
    console.warn = console.__tdOriginalWarn;
    console.info = console.__tdOriginalInfo;
    delete console.__tdOriginalLog;
    delete console.__tdOriginalError;
    delete console.__tdOriginalWarn;
    delete console.__tdOriginalInfo;

    if (debugConsoleSpy) {
      process.stdout.write("[DEBUG cleanupConsoleSpy] Console methods restored\n");
    }
  }

  if (debugConsoleSpy) {
    process.stdout.write(
      `[DEBUG cleanupConsoleSpy] clients remaining: ${_forwardingClients.size}\n`,
    );
  }
}

// Weak maps to store instances per test context
const testDriverInstances = new WeakMap();
const lifecycleHandlers = new WeakMap();

// Note: We intentionally do NOT register process signal handlers here.
// Under pool:"threads", process.on('SIGINT') and process.exit() are shared
// across all worker threads and cause chaos (stacked handlers, premature exits).
// Cleanup is handled by Vitest's onTestFinished() callback which runs reliably
// in all pool modes (forks, threads, vmForks).

/**
 * Create a TestDriver client in a Vitest test with automatic lifecycle management
 *
 * @param {import('vitest').TestContext} context - Vitest test context (from async (context) => {})
 * @param {import('../../sdk.js').TestDriverOptions} [options] - TestDriver options (passed directly to TestDriver constructor)
 * @returns {import('../../sdk.js').default} TestDriver client instance
 *
 * @example
 * test('my test', async (context) => {
 *   const testdriver = TestDriver(context, { headless: true });
 *
 *   // provision.chrome() automatically calls ready() and starts dashcam
 *   await testdriver.provision.chrome({ url: 'https://example.com' });
 *
 *   await testdriver.find('Login button').click();
 * });
 */
export function TestDriver(context, options = {}) {
  if (!context || !context.task) {
    throw new Error(
      'TestDriver() requires Vitest context. Pass the context parameter from your test function: test("name", async (context) => { ... })',
    );
  }

  // Return existing instance if already created for this test AND it's still connected
  // On retry, the previous instance will be disconnected, so we need to create a new one
  if (testDriverInstances.has(context.task)) {
    const existingInstance = testDriverInstances.get(context.task);
    if (existingInstance.connected) {
      return existingInstance;
    }
    // Instance exists but is disconnected (likely a retry) - remove it and create fresh
    testDriverInstances.delete(context.task);
    lifecycleHandlers.delete(context.task);
  }

  // Get global plugin options from environment or plugin config
  // Note: We do NOT read from globalThis.__testdriverPlugin (not thread-safe).
  // TestDriver options are passed via the options parameter directly.
  const pluginOptions = {};

  // Merge options: plugin global options < test-specific options
  const mergedOptions = { ...pluginOptions, ...options };

  // Support TD_OS environment variable for specifying target OS (linux, mac, windows)
  // Priority: test options > plugin options > environment variable > default (linux)
  if (!mergedOptions.os && process.env.TD_OS) {
    mergedOptions.os = process.env.TD_OS;
    console.log(
      `[testdriver] Set mergedOptions.os = ${mergedOptions.os} from TD_OS environment variable`,
    );
  }

  // Use IP from context if set by setup-aws.mjs (or other setup files)
  // Priority: test options > context.ip (from setup hooks)
  if (!mergedOptions.ip && context.ip) {
    mergedOptions.ip = context.ip;
    console.log(
      `[testdriver] Set mergedOptions.ip = ${mergedOptions.ip} from context.ip`,
    );
  }

  // Extract TestDriver-specific options
  const apiKey = mergedOptions.apiKey || process.env.TD_API_KEY;

  // Build config for TestDriverSDK constructor
  const config = { ...mergedOptions };
  delete config.apiKey;

  // Use TD_API_ROOT from environment if not provided in config
  if (!config.apiRoot && process.env.TD_API_ROOT) {
    config.apiRoot = process.env.TD_API_ROOT;
  }

  const testdriver = new TestDriverSDK(apiKey, config);
  testdriver.__vitestContext = context.task;
  testdriver._debugOnFailure = mergedOptions.debugOnFailure || false;
  testDriverInstances.set(context.task, testdriver);

  // Set platform metadata early so the reporter can show the correct OS from the start
  if (!context.task.meta) {
    context.task.meta = {};
  }
  const platform = mergedOptions.os || "linux";
  const absolutePath =
    context.task.file?.filepath || context.task.file?.name || "unknown";
  const projectRoot = process.cwd();
  const testFile =
    absolutePath !== "unknown"
      ? path.relative(projectRoot, absolutePath)
      : absolutePath;

  context.task.meta.platform = platform;
  context.task.meta.testFile = testFile;
  context.task.meta.testOrder = 0;

  // Pass test file name to SDK for debugger display
  testdriver.testFile = testFile;

  const debugConsoleSpy = process.env.TD_DEBUG_CONSOLE_SPY === "true";

  testdriver.__connectionPromise = (async () => {
    if (debugConsoleSpy) {
      console.log(
        "[DEBUG] Before auth - sandbox.instanceSocketConnected:",
        testdriver.sandbox?.instanceSocketConnected,
      );
    }

    await testdriver.auth();
    await testdriver.connect();

    // Clear the connection promise now that we're connected
    // This prevents deadlock when exec() is called below (exec() lazy-awaits __connectionPromise)
    testdriver.__connectionPromise = null;

    if (debugConsoleSpy) {
      console.log(
        "[DEBUG] After connect - sandbox.instanceSocketConnected:",
        testdriver.sandbox?.instanceSocketConnected,
      );
      console.log(
        "[DEBUG] After connect - sandbox.send:",
        typeof testdriver.sandbox?.send,
      );
    }

    // Only set up dashcam-related infrastructure if enabled (default: true)
    if (testdriver.dashcamEnabled) {
      // Set up console spy for dashcam visibility
      setupConsoleSpy(testdriver, context.task.id);

      // Create the log file on the remote machine
      const shell = testdriver.os === "windows" ? "pwsh" : "sh";
      const logPath =
        testdriver.os === "windows"
          ? "C:\\Users\\testdriver\\Documents\\testdriver.log"
          : "/tmp/testdriver.log";

      const createLogCmd =
        testdriver.os === "windows"
          ? `New-Item -ItemType File -Path "${logPath}" -Force | Out-Null`
          : `touch ${logPath}`;

      await testdriver.exec(shell, createLogCmd, 10000, true);

      // Add testdriver log to dashcam tracking
      await testdriver.dashcam.addFileLog(logPath, "TestDriver Log");

      // Web log tracking and dashcam.start() are handled by provision.chrome()
      // This ensures addWebLog is called with the domain pattern BEFORE dashcam.start()
    }
  })();

  // Register cleanup handler with dashcam.stop()
  // We always register a new cleanup handler because on retry we need to clean up the new instance
  const cleanup = async () => {
    // Get the current instance from the WeakMap (not from closure)
    // This ensures we clean up the correct instance on retries
    const currentInstance = testDriverInstances.get(context.task);
    if (!currentInstance) {
      return; // Already cleaned up
    }

    // Check if debug-on-failure mode is enabled and test failed
    const debugOnFailure = currentInstance._debugOnFailure;
    const testFailed = context.task.result?.state === "fail";

    if (debugOnFailure && testFailed) {
      // Get sandbox ID before we skip cleanup
      const instance = currentInstance.getInstance?.();
      const sandboxId = instance?.sandboxId || instance?.instanceId;

      console.log("");
      console.log(
        chalk.yellow(
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        ),
      );
      console.log(
        chalk.yellow("  DEBUG MODE: Sandbox kept alive for debugging"),
      );
      console.log(
        chalk.yellow(
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        ),
      );
      console.log("");
      console.log("  To connect via MCP:");
      console.log(
        chalk.cyan(`    session_start({ sandboxId: "${sandboxId}" })`),
      );
      console.log("");
      console.log(chalk.dim("  Sandbox will expire in 5 minutes."));
      console.log(
        chalk.yellow(
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        ),
      );
      console.log("");

      // Still stop dashcam to save the recording
      if (currentInstance._dashcam && currentInstance._dashcam.recording) {
        try {
          await currentInstance.dashcam.stop();
        } catch {
          // Ignore dashcam stop errors in debug mode
        }
      }

      // Clean up console spies
      cleanupConsoleSpy(currentInstance);

      // DO NOT disconnect or terminate - keep sandbox alive for debugging
      return;
    }

    try {
      // Ensure meta object exists
      if (!context.task.meta) {
        context.task.meta = {};
      }

      // Always set test metadata, even if dashcam never started or fails to stop
      // This ensures the reporter can record test results even for early failures
      const platform = currentInstance.os || "linux";
      const absolutePath =
        context.task.file?.filepath || context.task.file?.name || "unknown";
      const projectRoot = process.cwd();
      const testFile =
        absolutePath !== "unknown"
          ? path.relative(projectRoot, absolutePath)
          : absolutePath;

      // Set basic metadata that's always available
      context.task.meta.platform = platform;
      context.task.meta.testFile = testFile;
      context.task.meta.testOrder = 0;
      context.task.meta.sessionId = currentInstance.getSessionId?.() || null;

      // Initialize dashcamUrls array for tracking per-attempt URLs (persists across retries)
      if (!context.task.meta.dashcamUrls) {
        context.task.meta.dashcamUrls = [];
      }

      // Determine the current attempt number (1-based)
      const attemptNumber = context.task.meta.dashcamUrls.length + 1;
      const isRetry = attemptNumber > 1;
      const attemptLabel = isRetry ? ` (attempt ${attemptNumber})` : "";

      // Stop dashcam if it was started - with timeout to prevent hanging
      if (currentInstance._dashcam && currentInstance._dashcam.recording) {
        try {
          const dashcamUrl = await currentInstance.dashcam.stop();

          // Track this attempt's URL in the per-attempt array
          context.task.meta.dashcamUrls.push({
            attempt: attemptNumber,
            url: dashcamUrl || null,
            sessionId: currentInstance.getSessionId?.() || null,
          });

          // Keep backward compatibility - last attempt's URL
          context.task.meta.dashcamUrl = dashcamUrl || null;

          // Dashcam URL is set on context.task.meta.dashcamUrl above.
          // The reporter reads it from test.meta() — no globalThis needed.

          // Always print the dashcam URL for each attempt so it's visible in logs
          if (dashcamUrl) {
            console.log("");
            console.log(
              "🎥" + chalk.yellow(` Dashcam URL${attemptLabel}`) + `: ${dashcamUrl}`,
            );
            console.log("");
          }
        } catch (error) {
          // Log more detailed error information for debugging
          console.error(
            "❌ Failed to stop dashcam:",
            error.name || error.constructor?.name || "Error",
          );
          if (error.message) console.error("   Message:", error.message);
          // NotFoundError during cleanup is expected if sandbox already terminated
          if (
            error.name === "NotFoundError" ||
            error.responseData?.error === "NotFoundError"
          ) {
            console.log(
              "   ℹ️  Sandbox session already terminated - dashcam stop skipped",
            );
          }
          // Mark as not recording to prevent retries
          if (currentInstance._dashcam) {
            currentInstance._dashcam.recording = false;
          }
          // Track failed attempt
          context.task.meta.dashcamUrls.push({
            attempt: attemptNumber,
            url: null,
            sessionId: currentInstance.getSessionId?.() || null,
            error: error.message,
          });
          // Ensure dashcamUrl is set to null if stop failed
          context.task.meta.dashcamUrl = null;
        }
      } else {
        // No dashcam recording - still track the attempt
        context.task.meta.dashcamUrls.push({
          attempt: attemptNumber,
          url: null,
          sessionId: currentInstance.getSessionId?.() || null,
        });
        context.task.meta.dashcamUrl = null;
      }

      // Clean up console spies
      cleanupConsoleSpy(currentInstance);

      // Wait for connection to finish if it was initiated
      if (currentInstance.__connectionPromise) {
        await currentInstance.__connectionPromise.catch(() => {}); // Ignore connection errors during cleanup
      }

      // Disconnect with timeout
      await Promise.race([
        currentInstance.disconnect(),
        new Promise((resolve) => setTimeout(resolve, 5000)), // 5s timeout for disconnect
      ]);
    } catch (error) {
      console.error("Error disconnecting client:", error);
    } finally {
      // Terminate AWS instance if one was spawned for this test
      // This must happen AFTER dashcam.stop() to ensure recording is saved
      // AND it must happen even if disconnect() fails
      if (globalThis.__testdriverAWS?.terminateInstance) {
        await globalThis.__testdriverAWS.terminateInstance(context.task.id);
      }
    }
  };
  lifecycleHandlers.set(context.task, cleanup);

  // Vitest will call this automatically after the test (each retry attempt)
  context.onTestFinished?.(cleanup);

  return testdriver;
}
