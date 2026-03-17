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
const channelConfig = require("../../lib/resolve-channel.js");

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
 * Singleton console spy that forwards logs to all active sandbox connections.
 *
 * When --sequence.concurrent is used, multiple tests run at the same time in
 * the same worker process.  The previous implementation called vi.spyOn on
 * console.log once per test, stacking N mock layers deep.  Every console.log
 * then cascaded through all N layers — each one calling JSON.stringify inside
 * forwardToSandbox — easily exceeding the call-stack limit for ≥ ~30 tests.
 *
 * This singleton intercepts the console methods exactly **once** and keeps a
 * Set of active sandbox clients.  Each log call is forwarded to every active
 * client's sandbox in O(N) *flat* iterations instead of O(N) nested frames.
 */
const _consoleSpy = {
  /** @type {Set<import('../../sdk.js').default>} */
  activeClients: new Set(),
  installed: false,
  /** Original (un-spied) console references, captured once. */
  originals: /** @type {{ log: Function, error: Function, warn: Function, info: Function } | null} */ (null),
  spies: /** @type {{ log: any, error: any, warn: any, info: any } | null} */ (null),
};

const debugConsoleSpy = process.env.TD_DEBUG_CONSOLE_SPY === "true";

/**
 * Serialise console args to a single string for sandbox forwarding.
 * Falls back to toString on circular/huge objects to avoid blowing out the
 * stack inside JSON.stringify.
 */
function serialiseConsoleArgs(args) {
  return args
    .map((arg) => {
      if (typeof arg === "object" && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          // Circular reference or too deep — fall back safely
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(" ");
}

/**
 * Buffer a console message into every active client's local log buffer.
 * Replaces the old forwardToAllSandboxes which sent data over websocket
 * to the sandbox for dashcam file-log capture. Logs are now uploaded
 * directly to S3 from the vitest client at cleanup time.
 */
function bufferConsoleToClients(args, level) {
  if (_consoleSpy.activeClients.size === 0) return;

  const message = serialiseConsoleArgs(args);

  for (const client of _consoleSpy.activeClients) {
    if (client._logBuffer) {
      client._logBuffer.push({
        time: Date.now(),
        line: message,
        level: level || "log",
        source: "console",
      });
    }
  }
}

/**
 * Install the singleton console spy (idempotent).
 * Must be called *after* Vitest has set up its own console interception so
 * that the originals we capture are Vitest's wrappers (which feed the test
 * reporter output).
 */
function installConsoleSpy() {
  // Check both installed flag AND that spies are still valid.
  // Guards against a race where cleanupConsoleSpy restores mocks (setting
  // installed=false) while a new test is starting up concurrently.
  if (_consoleSpy.installed && _consoleSpy.spies) return;
  _consoleSpy.installed = true;

  // Capture originals once — these are whatever console methods look like
  // right now (possibly already wrapped by Vitest's own reporter).
  _consoleSpy.originals = {
    log: console.log.bind(console),
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    info: console.info.bind(console),
  };

  const makeHandler = (originalFn, level) => (...args) => {
    originalFn(...args);              // Let Vitest's reporter capture the output
    bufferConsoleToClients(args, level); // Buffer into local log store for S3 upload
  };

  _consoleSpy.spies = {
    log: vi.spyOn(console, "log").mockImplementation(makeHandler(_consoleSpy.originals.log, "log")),
    error: vi.spyOn(console, "error").mockImplementation(makeHandler(_consoleSpy.originals.error, "error")),
    warn: vi.spyOn(console, "warn").mockImplementation(makeHandler(_consoleSpy.originals.warn, "warn")),
    info: vi.spyOn(console, "info").mockImplementation(makeHandler(_consoleSpy.originals.info, "info")),
  };

  if (debugConsoleSpy) {
    process.stdout.write("[DEBUG consoleSpy] Singleton console spy installed\n");
  }
}

/**
 * Register a TestDriver client so its sandbox receives forwarded logs.
 * @param {import('../../sdk.js').default} client - TestDriver client instance
 * @param {string} taskId - Unique task identifier (for debug logging)
 */
function setupConsoleSpy(client, taskId) {
  if (debugConsoleSpy) {
    process.stdout.write(`[DEBUG setupConsoleSpy] registering taskId: ${taskId}\n`);
  }
  installConsoleSpy();
  _consoleSpy.activeClients.add(client);
}

/**
 * Unregister a client so its sandbox no longer receives forwarded logs.
 * When the last client is removed we restore the original console methods so
 * the Vitest worker fork can exit cleanly (unreleased vi.spyOn mocks prevent
 * the worker from shutting down, producing "Worker exited unexpectedly").
 * If another test starts later (e.g. a retry), installConsoleSpy() will
 * re-install the spy on demand.
 * @param {import('../../sdk.js').default} client - TestDriver client instance
 */
function cleanupConsoleSpy(client) {
  _consoleSpy.activeClients.delete(client);

  // Restore spies when no tests need them — allows clean worker exit
  if (_consoleSpy.activeClients.size === 0 && _consoleSpy.spies) {
    _consoleSpy.spies.log.mockRestore();
    _consoleSpy.spies.error.mockRestore();
    _consoleSpy.spies.warn.mockRestore();
    _consoleSpy.spies.info.mockRestore();
    _consoleSpy.spies = null;
    _consoleSpy.originals = null;
    _consoleSpy.installed = false;

    if (debugConsoleSpy) {
      process.stdout.write("[DEBUG cleanupConsoleSpy] All spies restored\n");
    }
  }

  if (debugConsoleSpy) {
    process.stdout.write(
      `[DEBUG cleanupConsoleSpy] clients remaining: ${_consoleSpy.activeClients.size}\n`,
    );
  }
}

// Weak maps to store instances per test context
const testDriverInstances = new WeakMap();
const lifecycleHandlers = new WeakMap();

/**
 * Upload buffered SDK + console logs directly to S3 via the existing Log system.
 * Extracts the replayId from the dashcam URL, calls POST /api/v1/logs to create
 * a Log record and get a presigned PUT URL, then uploads the JSONL payload.
 *
 * @param {import('../../sdk.js').default} client - TestDriver SDK instance
 * @param {string|null} dashcamUrl - Dashcam replay URL from dashcam.stop()
 */
async function uploadLogsToReplay(client, dashcamUrl) {
  if (!dashcamUrl) return;

  // Extract replayId from the dashcam URL (e.g. https://app.dashcam.io/replay/6789abcdef012345...)
  const replayMatch = dashcamUrl.match(/replay\/([a-f0-9]{24})/);
  if (!replayMatch) {
    if (debugConsoleSpy) {
      console.log("[uploadLogsToReplay] Could not extract replayId from:", dashcamUrl);
    }
    return;
  }

  const replayId = replayMatch[1];
  const logData = client.getLogs();

  if (!logData || logData.trim().length === 0) {
    if (debugConsoleSpy) {
      console.log("[uploadLogsToReplay] No logs to upload");
    }
    return;
  }

  try {
    // Get TD_API_KEY for auth (prefer SDK config which is always correctly resolved)
    const apiKey = client.config?.TD_API_KEY || process.env.TD_API_KEY;
    if (!apiKey) {
      console.warn("[TestDriver] TD_API_KEY not set, skipping log upload");
      return;
    }

    // Use the SDK's configured API root (matches what the SDK uses for all other API calls)
    const apiRoot = client.config?.TD_API_ROOT || process.env.TD_API_ROOT || channelConfig.channels[channelConfig.active];

    console.log(`[TestDriver] Uploading logs for replay ${replayId} to ${apiRoot}...`);

    const authRes = await fetch(`${apiRoot}/auth/exchange-api-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });

    if (!authRes.ok) {
      console.warn("[TestDriver] Failed to exchange API key for log upload:", authRes.status);
      return;
    }

    const authData = await authRes.json();
    const token = authData.token;

    // Create a Log record and get presigned upload URL
    const logCreateRes = await fetch(`${apiRoot}/api/v1/logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        replayId,
        appId: "testdriver-sdk",
        name: "TestDriver Log",
        type: "cli",
      }),
    });

    if (!logCreateRes.ok) {
      console.warn("[TestDriver] Failed to create log record:", logCreateRes.status);
      return;
    }

    const logCreateData = await logCreateRes.json();
    const uploadUrl = logCreateData.presignedUploadUrl;

    if (!uploadUrl) {
      console.warn("[TestDriver] No presigned upload URL returned from log-create");
      return;
    }

    // Upload the JSONL log data directly to S3
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/x-ndjson" },
      body: logData,
    });

    if (!uploadRes.ok) {
      console.warn("[TestDriver] Failed to upload logs to S3:", uploadRes.status);
      return;
    }

    console.log(`[TestDriver] ✅ Logs uploaded successfully for replay: ${replayId}`);
  } catch (err) {
    // Fire-and-forget — don't let log upload failure break the test
    console.warn("[TestDriver] Log upload failed:", err.message);
  }
}

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

  // Use instanceId from context if set by setup-aws.mjs
  // This allows the API to provision Ably credentials via SSM for direct connections
  if (!mergedOptions.instanceId && context.instanceId) {
    mergedOptions.instanceId = context.instanceId;
    console.log(
      `[testdriver] Set mergedOptions.instanceId = ${mergedOptions.instanceId} from context.instanceId`,
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

    // Set up console spy for local log buffering (always, regardless of dashcam)
    setupConsoleSpy(testdriver, context.task.id);

    // Note: We no longer create a log file on the sandbox or call dashcam.addFileLog().
    // TestDriver logs are buffered locally in _logBuffer and uploaded directly to S3
    // from the vitest client at cleanup time. This avoids the expensive path of
    // forwarding logs over websocket → sandbox file → dashcam upload.
    //
    // Web log tracking and dashcam.start() are still handled by provision.chrome()
    // This ensures addWebLog is called with the domain pattern BEFORE dashcam.start()
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

          // Also register in memory if plugin is available (for cross-process scenarios)
          if (globalThis.__testdriverPlugin?.registerDashcamUrl) {
            globalThis.__testdriverPlugin.registerDashcamUrl(
              context.task.id,
              dashcamUrl,
              platform,
              attemptNumber,
            );
          }

          // Always print the dashcam URL for each attempt so it's visible in logs
          if (dashcamUrl) {
            console.log("");
            console.log(
              "🎥" + chalk.yellow(` Dashcam URL${attemptLabel}`) + `: ${dashcamUrl}`,
            );
            console.log("");
          }

          // Upload buffered logs directly to S3 via the existing Log system.
          // This replaces the old path of forwarding logs to the sandbox for dashcam capture.
          await uploadLogsToReplay(currentInstance, dashcamUrl);
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
