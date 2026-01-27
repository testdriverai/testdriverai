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
import { vi } from "vitest";
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
 * Set up console spies using Vitest's vi.spyOn to intercept console logs
 * and forward them to the sandbox for Dashcam visibility.
 * This is test-isolated and doesn't cause conflicts with concurrent tests.
 * @param {TestDriver} client - TestDriver client instance
 * @param {string} taskId - Unique task identifier for this test
 */
function setupConsoleSpy(client, taskId) {
  // Debug logging for console spy setup
  const debugConsoleSpy = process.env.TD_DEBUG_CONSOLE_SPY === "true";
  if (debugConsoleSpy) {
    process.stdout.write(`[DEBUG setupConsoleSpy] taskId: ${taskId}\n`);
    process.stdout.write(
      `[DEBUG setupConsoleSpy] client.sandbox exists: ${!!client.sandbox}\n`,
    );
    process.stdout.write(
      `[DEBUG setupConsoleSpy] client.sandbox?.instanceSocketConnected: ${client.sandbox?.instanceSocketConnected}\n`,
    );
    process.stdout.write(
      `[DEBUG setupConsoleSpy] client.sandbox?.send: ${typeof client.sandbox?.send}\n`,
    );
  }

  // Track forwarding stats
  let forwardedCount = 0;
  let skippedCount = 0;

  // Helper to forward logs to sandbox
  const forwardToSandbox = (args) => {
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
      )
      .join(" ");

    // Send to sandbox for immediate visibility in dashcam
    if (client.sandbox && client.sandbox.instanceSocketConnected) {
      try {
        client.sandbox.send({
          type: "output",
          output: Buffer.from(message, "utf8").toString("base64"),
        });
        forwardedCount++;
        if (debugConsoleSpy && forwardedCount <= 3) {
          process.stdout.write(
            `[DEBUG forwardToSandbox] Forwarded message #${forwardedCount}: "${message.substring(0, 50)}..."\n`,
          );
        }
      } catch (err) {
        if (debugConsoleSpy) {
          process.stdout.write(
            `[DEBUG forwardToSandbox] Error sending: ${err.message}\n`,
          );
        }
      }
    } else {
      skippedCount++;
      if (debugConsoleSpy && skippedCount <= 3) {
        process.stdout.write(
          `[DEBUG forwardToSandbox] SKIPPED (sandbox not connected): "${message.substring(0, 50)}..."\n`,
        );
      }
    }
  };

  // Store original console methods before spying
  const originalLog = console.log.bind(console);
  const originalError = console.error.bind(console);
  const originalWarn = console.warn.bind(console);
  const originalInfo = console.info.bind(console);

  // Create spies for each console method
  const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
    originalLog(...args); // Call original (Vitest will capture this)
    forwardToSandbox(args);
  });

  const errorSpy = vi.spyOn(console, "error").mockImplementation((...args) => {
    originalError(...args);
    forwardToSandbox(args);
  });

  const warnSpy = vi.spyOn(console, "warn").mockImplementation((...args) => {
    originalWarn(...args);
    forwardToSandbox(args);
  });

  const infoSpy = vi.spyOn(console, "info").mockImplementation((...args) => {
    originalInfo(...args);
    forwardToSandbox(args);
  });

  // Store spies on client for cleanup
  client._consoleSpies = { logSpy, errorSpy, warnSpy, infoSpy };
}

/**
 * Clean up console spies and restore original console methods
 * @param {TestDriver} client - TestDriver client instance
 */
function cleanupConsoleSpy(client) {
  if (client._consoleSpies) {
    const { logSpy, errorSpy, warnSpy, infoSpy } = client._consoleSpies;
    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    infoSpy.mockRestore();
    delete client._consoleSpies;
  }
}

// Weak maps to store instances per test context
const testDriverInstances = new WeakMap();
const lifecycleHandlers = new WeakMap();

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

  // Get global plugin options if available
  const pluginOptions =
    globalThis.__testdriverPlugin?.state?.testDriverOptions || {};

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

    // Set up console spy using vi.spyOn (test-isolated)
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

    // Only set up dashcam if enabled (default: true)
    if (testdriver.dashcamEnabled) {
      // Add testdriver log to dashcam tracking
      await testdriver.dashcam.addFileLog(logPath, "TestDriver Log");

      // Start dashcam recording (always, regardless of provision method)
      await testdriver.dashcam.start();
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

      // Stop dashcam if it was started - with timeout to prevent hanging
      if (currentInstance._dashcam && currentInstance._dashcam.recording) {
        try {
          const dashcamUrl = await currentInstance.dashcam.stop();
          // Add dashcam URL to metadata
          context.task.meta.dashcamUrl = dashcamUrl || null;

          // Also register in memory if plugin is available (for cross-process scenarios)
          if (globalThis.__testdriverPlugin?.registerDashcamUrl) {
            globalThis.__testdriverPlugin.registerDashcamUrl(
              context.task.id,
              dashcamUrl,
              platform,
            );
          }

          const debugMode =
            process.env.VERBOSE || process.env.DEBUG || process.env.TD_DEBUG;

          if (debugMode) {
            console.log("");
            console.log(
              "🎥" + chalk.yellow(` Dashcam URL`) + `: ${dashcamUrl}`,
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
          // Ensure dashcamUrl is set to null if stop failed
          context.task.meta.dashcamUrl = null;
        }
      } else {
        // No dashcam recording, set URL to null explicitly
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
