/**
 * Test Helpers and Utilities
 * Shared functions for SDK tests
 */

import crypto from "crypto";
import { config } from "dotenv";
import fs from "fs";
import os from "os";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import TestDriver from "../../../sdk.js";
import {
  addDashcamLog,
  authDashcam,
  launchChrome,
  runPostrun,
  runPrerun,
  startDashcam,
  stopDashcam,
  waitForPage,
} from "./lifecycleHelpers.mjs";

// Re-export lifecycle helpers for backward compatibility
export {
  addDashcamLog,
  authDashcam,
  launchChrome,
  runPostrun,
  runPrerun,
  startDashcam,
  stopDashcam,
  waitForPage
};

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file in the project root
// Go up 3 levels from setup/ to reach the project root
const envPath = path.resolve(__dirname, "../../../.env");
config({ path: envPath });

// Log loaded env vars for debugging
console.log("🔧 Environment variables loaded from:", envPath);
console.log("   TD_API_KEY:", process.env.TD_API_KEY ? "✓ Set" : "✗ Not set");
console.log("   TD_API_ROOT:", process.env.TD_API_ROOT || "Not set");
console.log(
  "   TD_OS:",
  process.env.TD_OS || "Not set (will default to linux)",
);

// Global test results storage
const testResults = {
  tests: [],
  startTime: Date.now(),
};

/**
 * Store test result with dashcam URL
 * @param {string} testName - Name of the test
 * @param {string} testFile - Test file path
 * @param {string|null} dashcamUrl - Dashcam URL if available
 * @param {Object} sessionInfo - Session information
 */
export function storeTestResult(
  testName,
  testFile,
  dashcamUrl,
  sessionInfo = {},
) {
  console.log(`📝 Storing test result: ${testName}`);
  console.log(`   Dashcam URL: ${dashcamUrl || "none"}`);

  // Extract replay object ID from dashcam URL
  let replayObjectId = null;
  if (dashcamUrl) {
    const replayIdMatch = dashcamUrl.match(/\/replay\/([^?]+)/);
    replayObjectId = replayIdMatch ? replayIdMatch[1] : null;
    if (replayObjectId) {
      console.log(`   Replay Object ID: ${replayObjectId}`);
    }
  }

  testResults.tests.push({
    name: testName,
    file: testFile,
    dashcamUrl,
    replayObjectId,
    sessionId: sessionInfo.sessionId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get all test results
 * @returns {Object} All collected test results
 */
export function getTestResults() {
  return {
    ...testResults,
    endTime: Date.now(),
    duration: Date.now() - testResults.startTime,
  };
}

/**
 * Save test results to a JSON file
 * @param {string} outputPath - Path to save the results
 */
export function saveTestResults(outputPath = "test-results/sdk-summary.json") {
  const results = getTestResults();
  const dir = path.dirname(outputPath);

  // Create directory if it doesn't exist
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n📊 Test results saved to: ${outputPath}`);

  // Also print dashcam URLs to console
  console.log("\n🎥 Dashcam URLs:");
  results.tests.forEach((test) => {
    if (test.dashcamUrl) {
      console.log(`  ${test.name}: ${test.dashcamUrl}`);
    }
  });

  return results;
}

/**
 * Intercept console logs and forward to TestDriver sandbox
 * @param {TestDriver} client - TestDriver client instance
 * @param {string} taskId - Unique task identifier for this test
 */
function setupConsoleInterceptor(client, taskId) {
  // Store original console methods
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
  };

  // Create wrapper that forwards to sandbox
  const createInterceptor = (level, originalMethod) => {
    return function (...args) {
      // Call original console method first
      originalMethod.apply(console, args);

      // Forward to sandbox if connected
      if (client.sandbox && client.sandbox.instanceSocketConnected) {
        try {
          // Format the log message
          const message = args
            .map((arg) =>
              typeof arg === "object"
                ? JSON.stringify(arg, null, 2)
                : String(arg),
            )
            .join(" ");

          // Preserve ANSI color codes and emojis for rich sandbox output
          // (don't add level prefix - sdk-log-formatter handles styling)
          const logOutput = message;

          client.sandbox.send({
            type: "output",
            output: Buffer.from(logOutput, "utf8").toString("base64"),
          });
        } catch (error) {
          // Silently fail to avoid breaking the test
          // Use original console to avoid infinite loop
          originalConsole.error(
            `[TestHelpers] Failed to forward log to sandbox:`,
            error.message,
          );
        }
      }
    };
  };

  // Replace console methods with interceptors
  console.log = createInterceptor("log", originalConsole.log);
  console.error = createInterceptor("error", originalConsole.error);
  console.warn = createInterceptor("warn", originalConsole.warn);
  console.info = createInterceptor("info", originalConsole.info);

  // Store original methods and taskId on client for cleanup
  client._consoleInterceptor = {
    taskId,
    original: originalConsole,
  };

  // Use original console for this message
  originalConsole.log(
    `[TestHelpers] Console interceptor enabled for task: ${taskId}`,
  );
}

/**
 * Remove console interceptor and restore original console methods
 * @param {TestDriver} client - TestDriver client instance
 */
function removeConsoleInterceptor(client) {
  if (client._consoleInterceptor) {
    const { original, taskId } = client._consoleInterceptor;

    // Restore original console methods
    console.log = original.log;
    console.error = original.error;
    console.warn = original.warn;
    console.info = original.info;

    // Use original console for cleanup message
    original.log(
      `[TestHelpers] Console interceptor removed for task: ${taskId}`,
    );

    // Clean up reference
    delete client._consoleInterceptor;
  }
}

/**
 * Create a configured TestDriver client
 * @param {Object} options - Additional options
 * @param {Object} options.task - Vitest task context (from beforeEach/it context)
 * @returns {TestDriver} Configured client
 */
export function createTestClient(options = {}) {
  // Check if API key is set
  if (!process.env.TD_API_KEY) {
    console.error("\n❌ Error: TD_API_KEY is not set!");
    console.error("Please set it in one of the following ways:");
    console.error(
      "  1. Create a .env file in the project root with: TD_API_KEY=your_key",
    );
    console.error(
      "  2. Pass it as an environment variable: TD_API_KEY=your_key npm run test:sdk",
    );
    console.error("  3. Export it in your shell: export TD_API_KEY=your_key\n");
    throw new Error("TD_API_KEY environment variable is required");
  }

  // Determine OS from TEST_PLATFORM or TD_OS
  const os = process.env.TEST_PLATFORM || "linux";

  // Extract task context if provided - we use taskId but remove task from clientOptions
  let taskId = options.task?.id || options.task?.name || null;

  // Remove task from options before passing to TestDriver (eslint wants us to use 'task')
  // eslint-disable-next-line no-unused-vars
  const { task, ...clientOptions } = options;

  const client = new TestDriver(process.env.TD_API_KEY, {
    resolution: "1366x768",
    analytics: true,
    os: os, // Use OS from environment variable (windows or linux)
    apiKey: process.env.TD_API_KEY,
    apiRoot: process.env.TD_API_ROOT || "https://testdriver-api.onrender.com",
    // headless: false,
    newSandbox: true, 
    // ip: '18.217.194.23'
    // ...clientOptions,
    // cache: false,
  });

  console.log(
    "🔧 createTestClient: SDK created, cacheThresholds =",
    client.cacheThresholds,
  );

  console.log(`[TestHelpers] Client OS configured as: ${client.os}`);

  // Set Vitest task ID if available (for log filtering in parallel tests)
  if (taskId) {
    console.log(`[TestHelpers] Storing task ID on client: ${taskId}`);
    // Store task ID directly on client for later use in teardown
    client.vitestTaskId = taskId;
  } else {
    console.log(`[TestHelpers] No task ID available`);
  }

  // Enable detailed event logging if requested
  if (process.env.DEBUG_EVENTS === "true") {
    setupEventLogging(client);
  }

  return client;
}

/**
 * Set up detailed event logging for debugging
 * @param {TestDriver} client - TestDriver client
 */
export function setupEventLogging(client) {
  const emitter = client.getEmitter();

  // Log all events
  emitter.on("**", function (data) {
    const event = this.event;
    if (event.startsWith("log:debug")) return; // Skip debug logs
    console.log(`[EVENT] ${event}`, data || "");
  });

  // Log command lifecycle
  emitter.on("command:start", (data) => {
    console.log("🚀 Command started:", data);
  });

  emitter.on("command:success", (data) => {
    console.log("✅ Command succeeded:", data);
  });

  emitter.on("command:error", (data) => {
    console.error("❌ Command error:", data);
  });

  // Log sandbox events
  emitter.on("sandbox:connected", () => {
    console.log("🔌 Sandbox connected");
  });

  emitter.on("sandbox:authenticated", () => {
    console.log("🔐 Sandbox authenticated");
  });

  emitter.on("sandbox:error", (error) => {
    console.error("⚠️  Sandbox error:", error);
  });

  // Log SDK API calls
  emitter.on("sdk:request", (data) => {
    console.log("📤 SDK Request:", data);
  });

  emitter.on("sdk:response", (data) => {
    console.log("📥 SDK Response:", data);
  });
}

/**
 * Setup function to run before each test
 * Authenticates and connects to sandbox
 * @param {TestDriver} client - TestDriver client
 * @param {Object} options - Connection options
 * @returns {Promise<Object>} Sandbox instance
 */
export async function setupTest(client, options = {}) {
  await client.auth();
  const instance = await client.connect({
    ...options,
  });

  // Set up console interceptor after connection (needs sandbox to be connected)
  if (client.vitestTaskId) {
    setupConsoleInterceptor(client, client.vitestTaskId);
  }

  // Run prerun lifecycle if enabled
  if (options.prerun !== false) {
    await runPrerun(client);
  }

  return instance;
}

/**
 * Initialize a test run for the entire suite
 * Should be called once in beforeEach
 * @param {Object} suiteTask - Vitest suite task context
 * @returns {Promise<Object>} Test run info { runId, testRunDbId, token }
 */
export async function initializeSuiteTestRun(suiteTask) {
  const apiKey = process.env.TD_API_KEY;
  const apiRoot =
    process.env.TD_API_ROOT || "https://testdriver-api.onrender.com";

  if (!apiKey || !globalThis.__testdriverPlugin) {
    console.log(
      `[TestHelpers] Skipping suite test run initialization - no API key or plugin`,
    );
    return null;
  }

  // Check if test run already exists for this suite
  const existingRun = globalThis.__testdriverPlugin.getSuiteTestRun(
    suiteTask.id,
  );
  if (existingRun) {
    console.log(
      `[TestHelpers] Test run already exists for suite: ${existingRun.runId}`,
    );
    return existingRun;
  }

  try {
    console.log(
      `[TestHelpers] Initializing test run for suite: ${suiteTask.name}`,
    );

    // Authenticate
    const token = await globalThis.__testdriverPlugin.authenticateWithApiKey(
      apiKey,
      apiRoot,
    );
    console.log(`[TestHelpers] ✅ Authenticated for suite`);

    // Create test run for the suite
    const runId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const testFile = suiteTask.file?.name || "unknown";
    const testRunData = {
      runId,
      suiteName: suiteTask.name || testFile,
    };

    const testRunResponse =
      await globalThis.__testdriverPlugin.createTestRunDirect(
        token,
        apiRoot,
        testRunData,
      );
    const testRunDbId = testRunResponse.data?.id;

    const runInfo = { runId, testRunDbId, token };

    // Store in plugin state
    globalThis.__testdriverPlugin.setSuiteTestRun(suiteTask.id, runInfo);

    // Set environment variables for the reporter to use
    process.env.TD_TEST_RUN_ID = runId;
    process.env.TD_TEST_RUN_DB_ID = testRunDbId;
    process.env.TD_TEST_RUN_TOKEN = token;

    console.log(
      `[TestHelpers] ✅ Created test run for suite: ${runId} (DB ID: ${testRunDbId})`,
    );

    return runInfo;
  } catch (error) {
    console.error(
      `[TestHelpers] ❌ Failed to initialize suite test run:`,
      error.message,
    );
    return null;
  }
}

/**
 * Teardown function to run after each test
 * @param {TestDriver} client - TestDriver client
 * @param {Object} options - Teardown options
 * @param {Object} options.task - Vitest task context (optional, for storing in task.meta)
 * @param {string} options.dashcamUrl - Dashcam URL if already retrieved
 * @param {boolean} options.postrun - Whether to run postrun lifecycle (default: true)
 * @param {boolean} options.disconnect - Whether to disconnect client (default: true)
 * @returns {Promise<Object>} Session info including dashcam URL
 */
export async function teardownTest(client, options = {}) {
  let dashcamUrl = options.dashcamUrl || null;

  console.log("🧹 Running teardown...");

  try {
    // Run postrun lifecycle if enabled and dashcamUrl not already provided
    if (options.postrun !== false && !dashcamUrl) {
      dashcamUrl = await runPostrun(client);

      // Store dashcamUrl in client for reporter access
      if (dashcamUrl) {
        // Extract replay object ID from URL
        // URL format: https://app.testdriver.ai/replay/{replayObjectId}?share={shareToken}
        const replayIdMatch = dashcamUrl.match(/\/replay\/([^?]+)/);
        const replayObjectId = replayIdMatch ? replayIdMatch[1] : null;

        console.log(`🎥 Dashcam URL: ${dashcamUrl}`);
        if (replayObjectId) {
          console.log(`📝 Replay Object ID: ${replayObjectId}`);
        }

        // Store dashcam URL in task meta
        if (options.task) {
          options.task.meta.testdriverDashcamUrl = dashcamUrl;
          options.task.meta.testdriverReplayObjectId = replayObjectId;
          console.log(
            `[TestHelpers] ✅ Stored dashcam URL in task.meta for test: ${options.task.name}`,
          );
        }
      }
    } else {
      console.log("⏭️  Postrun skipped (disabled in options)");
    }

    // Write test result to a file for the reporter to pick up (cross-process communication)
    if (options.task) {
      const testResultFile = path.join(
        os.tmpdir(),
        "testdriver-results",
        `${options.task.id}.json`,
      );

      try {
        // Ensure directory exists
        const dir = path.dirname(testResultFile);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Get test file path
        const testFile =
          options.task.file?.filepath || options.task.file?.name || "unknown";

        // Calculate test order (index within parent suite)
        let testOrder = 0;
        if (options.task.suite && options.task.suite.tasks) {
          testOrder = options.task.suite.tasks.indexOf(options.task);
        }

        // Note: Duration is calculated by Vitest and passed via result.duration
        // We include it in the test result file so the reporter can use it

        // Get duration from Vitest result
        const result = options.task.result?.();
        const duration = result?.duration || 0;

        // Write test result with dashcam URL, platform, and metadata
        const testResult = {
          testId: options.task.id,
          testName: options.task.name,
          testFile: testFile,
          testOrder: testOrder,
          dashcamUrl: dashcamUrl,
          replayObjectId: dashcamUrl
            ? dashcamUrl.match(/\/replay\/([^?]+)/)?.[1]
            : null,
          platform: client.os, // Include platform from SDK client (source of truth)
          timestamp: Date.now(),
          duration: duration, // Include duration from Vitest
        };

        fs.writeFileSync(testResultFile, JSON.stringify(testResult, null, 2));
        console.log(
          `[TestHelpers] ✅ Wrote test result to file: ${testResultFile} (testFile: ${testFile}, testOrder: ${testOrder})`,
        );
      } catch (error) {
        console.error(
          `[TestHelpers] ❌ Failed to write test result file:`,
          error.message,
        );
      }
    }
  } catch (error) {
    console.error("❌ Error in postrun:", error);
    console.error("❌ Error stack:", error.stack);
  } finally {
    // Remove console interceptor before disconnecting
    removeConsoleInterceptor(client);

    // Only disconnect if not explicitly disabled
    if (options.disconnect !== false) {
      console.log("🔌 Disconnecting client...");
      try {
        await client.disconnect();
        console.log("✅ Client disconnected");
      } catch (disconnectError) {
        console.error("❌ Error disconnecting:", disconnectError.message);
        // Don't throw - we're already in cleanup
      }
    } else {
      console.log("⏭️  Disconnect skipped (disabled in options)");
    }
  }

  // Extract replay object ID from dashcam URL
  let replayObjectId = null;
  if (dashcamUrl) {
    const replayIdMatch = dashcamUrl.match(/\/replay\/([^?]+)/);
    replayObjectId = replayIdMatch ? replayIdMatch[1] : null;
  }

  const sessionInfo = {
    sessionId: client.getSessionId(),
    dashcamUrl: dashcamUrl,
    replayObjectId: replayObjectId,
    instance: client.getInstance(),
  };

  console.log("📊 Session info:", JSON.stringify(sessionInfo, null, 2));

  return sessionInfo;
}

/**
 * Perform login flow (reusable snippet)
 * @param {TestDriver} client - TestDriver client
 * @param {string} username - Username (default: 'standard_user')
 * @param {string} password - Password (default: retrieved from screen)
 */
export async function performLogin(
  client,
  username = "standard_user",
  password = null,
) {
  await client.focusApplication("Google Chrome");

  // Get password from screen if not provided
  if (!password) {
    password = await client.remember("the password");
  }

  const usernameField = await client.find(
    "Username, label above the username input field on the login form",
  );
  await usernameField.click();
  await client.type(username);

  // Enter password
  await client.pressKeys(["tab"]);
  await client.type(password);

  // Submit form
  await client.pressKeys(["tab"]);
  await client.pressKeys(["enter"]);
}

/**
 * Wait with retry logic
 * @param {Function} fn - Async function to retry
 * @param {number} retries - Number of retries (default: 3)
 * @param {number} delay - Delay between retries in ms (default: 1000)
 * @returns {Promise} Result of successful execution
 */
export async function retryAsync(fn, retries = 3, delay = 1000) {
  let lastError;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
