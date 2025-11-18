/**
 * Test Helpers and Utilities
 * Shared functions for SDK tests
 */

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
if (process.env.DEBUG_ENV === "true") {
  console.log("🔧 Environment variables loaded from:", envPath);
  console.log("   TD_API_KEY:", process.env.TD_API_KEY ? "✓ Set" : "✗ Not set");
  console.log("   TD_API_ROOT:", process.env.TD_API_ROOT || "Not set");
  console.log(
    "   TD_OS:",
    process.env.TD_OS || "Not set (will default to linux)",
  );
}

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

  testResults.tests.push({
    name: testName,
    file: testFile,
    dashcamUrl,
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
 * Create a configured TestDriver client
 * @param {Object} options - Additional options
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

  const os = process.env.TD_OS || "linux";

  const client = new TestDriver(process.env.TD_API_KEY, {
    resolution: "1366x768",
    analytics: true,
    os: os, // Use OS from environment variable (windows or linux)
    apiKey: process.env.TD_API_KEY,
    apiRoot: process.env.TD_API_ROOT || "https://testdriver-api.onrender.com",
    headless: true,
    newSandbox: true, // Always create a new sandbox for each test
    ...options,
    cache: true, // Force cache disabled - put AFTER ...options to ensure it's not overridden
  });

  console.log(
    "🔧 createTestClient: SDK created, cacheThresholds =",
    client.cacheThresholds,
  );

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
 * @returns {Promise<Object>} Session info including dashcam URL
 */
export async function teardownTest(client, options = {}) {
  let dashcamUrl = null;

  console.log("🧹 Running teardown...");

  try {
    // Run postrun lifecycle if enabled
    if (options.postrun !== false) {
      dashcamUrl = await runPostrun(client);
    } else {
      console.log("⏭️  Postrun skipped (disabled in options)");
    }
  } catch (error) {
    console.error("❌ Error in postrun:", error);
  } finally {
    await client.disconnect();
  }

  const sessionInfo = {
    sessionId: client.getSessionId(),
    dashcamUrl: dashcamUrl,
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
  try {
    await client.exec(
      "sh",
      `dashcam auth 4e93d8bf-3886-4d26-a144-116c4063522d`,
      10000,
      true,
    );

    // Start dashcam tracking
    await client.exec(
      "sh",
      'dashcam logs --add --type=file --file="/tmp/testdriver.log" --name="TestDriver Log"',
      10000,
      true,
    );

    // Start dashcam recording
    await client.exec("sh", "dashcam record >/dev/null 2>&1 &");

    // Launch Chrome with guest mode directly (not jumpapp to avoid focus issues)
    await client.exec(
      "sh",
      'google-chrome --start-maximized --disable-fre --no-default-browser-check --no-first-run --guest "http://testdriver-sandbox.vercel.app/" >/dev/null 2>&1 &',
      30000,
    );

    // Wait for the login page to load - poll for text to appear
    let loginPage = await client.find("TestDriver.ai Sandbox");
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      loginPage = await loginPage.find();
      if (loginPage.found()) break;
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  } catch (error) {
    console.warn("⚠️  Prerun hook failed (non-fatal):", error.message);
  }
}

/**
 * Run postrun lifecycle hooks
 * Implements lifecycle/postrun.yaml functionality
 * @param {TestDriver} client - TestDriver client
 * @returns {Promise<string|null>} Dashcam URL if available
 */
export async function runPostrun(client) {
  try {
    console.log("🎬 Stopping dashcam and retrieving URL...");

    // Stop dashcam with title and push - this returns the URL
    const output = await client.exec("sh", "dashcam stop", 30000, false); // Don't silence output so we can capture it

    console.log("📤 Dashcam command output:", output);

    // Extract URL from output - dashcam typically outputs the URL in the response
    // The URL is usually in the format: https://dashcam.testdriver.ai/...
    if (output) {
      const urlMatch = output.match(/https?:\/\/[^\s]+/);
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
  } catch (error) {
    console.warn("⚠️  Postrun hook failed (non-fatal):", error.message);
    return null;
  }
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
