/**
 * Test Helpers and Utilities
 * Shared functions for SDK tests
 */

import crypto from "crypto";
import { config } from "dotenv";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import TestDriver from "../../../sdk.js";

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
              typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
            )
            .join(" ");

          // Preserve ANSI color codes and emojis for rich sandbox output
          const logOutput = `[${level.toUpperCase()}] ${message}`;

          client.sandbox.send({
            type: "output",
            output: Buffer.from(logOutput, 'utf8').toString("base64"),
          });
        } catch (error) {
          // Silently fail to avoid breaking the test
          // Use original console to avoid infinite loop
          originalConsole.error(
            `[TestHelpers] Failed to forward log to sandbox:`,
            error.message
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
  originalConsole.log(`[TestHelpers] Console interceptor enabled for task: ${taskId}`);
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
    original.log(`[TestHelpers] Console interceptor removed for task: ${taskId}`);

    // Clean up reference
    delete client._consoleInterceptor;
  }
}

/**
 * Create a configured TestDriver client
 * @param {Object} options - Additional options
 * @param {Object} options.task - Vitest task context (from beforeAll/it context)
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
    headless: false,
    newSandbox: false, // Always create a new sandbox for each test
    ...clientOptions, // This will include signal if passed in
    cache: true, // Force cache disabled - put AFTER ...options to ensure it's not overridden
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
    console.log(
      `[TestHelpers] No task ID available`,
    );
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
 * Teardown function to run after each test
 * @param {TestDriver} client - TestDriver client
 * @param {Object} options - Teardown options
 * @param {Object} options.task - Vitest task context (optional, for storing in task.meta)
 * @returns {Promise<Object>} Session info including dashcam URL
 */
export async function teardownTest(client, options = {}) {
  let dashcamUrl = null;

  console.log("🧹 Running teardown...");

  try {
    // Run postrun lifecycle if enabled
    if (options.postrun !== false) {
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
          console.log(`[TestHelpers] ✅ Stored dashcam URL in task.meta for test: ${options.task.name}`);
          
          // Report the test case directly if API key is available
          const apiKey = process.env.TD_API_KEY;
          const apiRoot = process.env.TD_API_ROOT || "https://testdriver-api.onrender.com";
          
          if (apiKey && globalThis.__testdriverPlugin) {
            try {
              // Get result
              const result = typeof options.task.result === 'function' 
                ? options.task.result() 
                : options.task.result;
                
              let status = "passed";
              let errorMessage = null;
              let errorStack = null;

              if (result?.state === "failed") {
                status = "failed";
                if (result.errors && result.errors.length > 0) {
                  const error = result.errors[0];
                  errorMessage = error.message;
                  errorStack = error.stack;
                }
              } else if (result?.state === "skipped") {
                status = "skipped";
              }

              const testFile = options.task.file?.name || "unknown";
              const suiteName = options.task.suite?.name;

              // Authenticate and create a test run for this specific test
              const token = await globalThis.__testdriverPlugin.authenticateWithApiKey(apiKey, apiRoot);
              
              // Create test run
              const runId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
              const testRunData = {
                runId,
                suiteName: suiteName || testFile,
              };
              
              const testRunResponse = await globalThis.__testdriverPlugin.createTestRunDirect(token, apiRoot, testRunData);
              const testRunDbId = testRunResponse.data?.id;
              console.log(`[TestHelpers] ✅ Created test run: ${runId} (DB ID: ${testRunDbId})`);

              // Record test case with dashcam URL
              const testCaseData = {
                runId,
                testName: options.task.name,
                testFile,
                status,
                startTime: Date.now() - (result?.duration || 0),
                endTime: Date.now(),
                duration: result?.duration || 0,
                retries: result?.retryCount || 0,
                replayUrl: dashcamUrl,
              };

              if (suiteName) testCaseData.suiteName = suiteName;
              if (errorMessage) testCaseData.errorMessage = errorMessage;
              if (errorStack) testCaseData.errorStack = errorStack;

              const testCaseResponse = await globalThis.__testdriverPlugin.recordTestCaseDirect(token, apiRoot, testCaseData);
              const testCaseDbId = testCaseResponse.data?.id;
              console.log(`[TestHelpers] ✅ Reported test case to API with dashcam URL`);
              console.log(`[TestHelpers] 🔗 View test run: ${apiRoot.replace('testdriver-api.onrender.com', 'app.testdriver.ai')}/test-runs/${testRunDbId}/${testCaseDbId}`);
            } catch (error) {
              console.error(`[TestHelpers] ❌ Failed to report test case:`, error.message);
            }
          }
        } else {
          console.warn(`[TestHelpers] ⚠️  No task available, dashcam URL not stored in meta`);
        }
      }
    } else {
      console.log("⏭️  Postrun skipped (disabled in options)");
    }
  } catch (error) {
    console.error("❌ Error in postrun:", error);
  } finally {
    // Remove console interceptor before disconnecting
    removeConsoleInterceptor(client);
    
    await client.disconnect();
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
 * Run prerun lifecycle hooks
 * Implements lifecycle/prerun.yaml functionality
 * @param {TestDriver} client - TestDriver client
 */
export async function runPrerun(client) {
  // Determine shell command based on OS
  const shell = client.os === "windows" ? "pwsh" : "sh";
  const logPath =
    client.os === "windows"
      ? "C:\\Users\\testdriver\\Documents\\testdriver.log"
      : "/tmp/testdriver.log";

  await client.exec(
    shell,
    `dashcam auth 4e93d8bf-3886-4d26-a144-116c4063522d`,
    30000,
    true,
  );

  // Start dashcam tracking
  await client.exec(
    shell,
    `dashcam logs --add --type=file --file="${logPath}" --name="TestDriver Log"`,
    10000,
    true,
  );

  // Start dashcam recording
  if (client.os === "windows") {
    // Use cmd.exe to run dashcam record in background on Windows
    await client.exec(
      "pwsh",
      "Start-Process cmd.exe -ArgumentList '/c', 'dashcam record' -WindowStyle Hidden",
    );
  } else {
    await client.exec(shell, "dashcam record >/dev/null 2>&1 &");
  }

  // Launch Chrome with guest mode directly (not jumpapp to avoid focus issues)
  if (client.os === "windows") {
    await client.exec(
      "pwsh",
      'Start-Process "C:/Program Files/Google/Chrome/Application/chrome.exe" -ArgumentList "--start-maximized", "--guest", "https://testdriver-sandbox.vercel.app/login"',
      30000,
    );
  } else {
    await client.exec(
      shell,
      'google-chrome --start-maximized --disable-fre --no-default-browser-check --no-first-run --guest "http://testdriver-sandbox.vercel.app/" >/dev/null 2>&1 &',
      30000,
    );
  }

  // Wait for the login page to load - poll for text to appear
  let loginPage = await client.find("TestDriver.ai Sandbox");
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    loginPage = await loginPage.find();
    if (loginPage.found()) break;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

/**
 * Run postrun lifecycle hooks
 * Implements lifecycle/postrun.yaml functionality
 * @param {TestDriver} client - TestDriver client
 * @returns {Promise<string|null>} Dashcam URL if available
 */
export async function runPostrun(client) {
  console.log("🎬 Stopping dashcam and retrieving URL...");

  // Determine shell command based on OS
  const shell = client.os === "windows" ? "pwsh" : "sh";

  // Stop dashcam with title and push - this returns the URL
  const output = await client.exec(shell, "dashcam stop", 60000, false); // Don't silence output so we can capture it

  console.log("📤 Dashcam command output:", output);

  // Extract URL from output - dashcam typically outputs the URL in the response
  // The URL is usually in the format: https://dashcam.testdriver.ai/...
  if (output) {
    // Match URL but stop at whitespace or quotes
    const urlMatch = output.match(/https?:\/\/[^\s"']+/);
    if (urlMatch) {
      const url = urlMatch[0];
      console.log("✅ Found dashcam URL:", url);
      return url;
    } else {
      console.warn("⚠️  No URL found in dashcam output");
    }
  } else {
    console.warn("⚠️  Dashcam command returned no output");
  }

  return null;
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
