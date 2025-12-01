/**
 * Repo-Specific Test Helpers
 * 
 * These helpers are specific to this repository's test infrastructure.
 * For reusable plugin helpers, import from 'testdriverai/vitest' (or src/vitest/index.mjs locally)
 */

import crypto from "crypto";
import { config } from "dotenv";
import fs from "fs";
import os from "os";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

// Import TestDriver SDK locally (for repo development)
import TestDriver from "../../../sdk.js";

// Import plugin helpers
import {
  addDashcamLog,
  authDashcam,
  launchChrome,
  launchChromeExtension,
  launchChromeForTesting,
  runPostrun,
  runPrerun,
  runPrerunChromeExtension,
  runPrerunChromeForTesting,
  startDashcam,
  stopDashcam,
  waitForPage,
} from "../../../src/vitest/lifecycle.mjs";

import {
  retryAsync,
  setupEventLogging,
  sleep,
  waitFor,
} from "../../../src/vitest/utils.mjs";

// Re-export plugin lifecycle helpers for backward compatibility
export {
  addDashcamLog,
  authDashcam,
  launchChrome,
  launchChromeExtension,
  launchChromeForTesting,
  runPostrun,
  runPrerun,
  runPrerunChromeExtension,
  runPrerunChromeForTesting,
  startDashcam,
  stopDashcam,
  waitForPage
};

// Re-export plugin utilities for backward compatibility
  export {
    retryAsync,
    setupEventLogging,
    sleep,
    waitFor
  };

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file in the project root
const envPath = path.resolve(__dirname, "../../../.env");
config({ path: envPath });

// Log loaded env vars for debugging
console.log("🔧 Environment variables loaded from:", envPath);
console.log("   TD_API_KEY:", process.env.TD_API_KEY ? "✓ Set" : "✗ Not set");
console.log("   TD_API_ROOT:", process.env.TD_API_ROOT || "Not set");
console.log("   TD_OS:", process.env.TD_OS || "Not set (will default to linux)");

// =============================================================================
// TEST RESULTS STORAGE (Repo-specific CI/CD integration)
// =============================================================================

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
export function storeTestResult(testName, testFile, dashcamUrl, sessionInfo = {}) {
  console.log(`📝 Storing test result: ${testName}`);
  console.log(`   Dashcam URL: ${dashcamUrl || "none"}`);

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

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n📊 Test results saved to: ${outputPath}`);

  console.log("\n🎥 Dashcam URLs:");
  results.tests.forEach((test) => {
    if (test.dashcamUrl) {
      console.log(`  ${test.name}: ${test.dashcamUrl}`);
    }
  });

  return results;
}

// =============================================================================
// REPO-SPECIFIC CLIENT CREATION
// =============================================================================

/**
 * Create a configured TestDriver client for this repo's tests
 * Uses local SDK path for development
 * @param {Object} options - Additional options
 * @returns {TestDriver} Configured client
 */
export function createTestClient(options = {}) {
  if (!process.env.TD_API_KEY) {
    console.error("\n❌ Error: TD_API_KEY is not set!");
    console.error("Please set it in one of the following ways:");
    console.error("  1. Create a .env file in the project root with: TD_API_KEY=your_key");
    console.error("  2. Pass it as an environment variable: TD_API_KEY=your_key npm run test:sdk");
    console.error("  3. Export it in your shell: export TD_API_KEY=your_key\n");
    throw new Error("TD_API_KEY environment variable is required");
  }

  const osConfig = process.env.TEST_PLATFORM || "linux";
  const { task, ...clientOptions } = options;
  const taskId = task?.id || task?.name || null;

  const client = new TestDriver(process.env.TD_API_KEY, {
    resolution: "1366x768",
    analytics: true,
    os: osConfig,
    apiKey: process.env.TD_API_KEY,
    apiRoot: process.env.TD_API_ROOT || "https://testdriver-api.onrender.com",
    newSandbox: true,
    ...clientOptions,
  });

  console.log("🔧 createTestClient: SDK created, cacheThresholds =", client.cacheThresholds);
  console.log(`[TestHelpers] Client OS configured as: ${client.os}`);

  if (taskId) {
    console.log(`[TestHelpers] Storing task ID on client: ${taskId}`);
    client.vitestTaskId = taskId;
  }

  if (process.env.DEBUG_EVENTS === "true") {
    setupEventLogging(client);
  }

  return client;
}

// =============================================================================
// REPO-SPECIFIC LOGIN HELPER (for TestDriver Sandbox)
// =============================================================================

/**
 * Perform login flow on TestDriver Sandbox
 * This is specific to http://testdriver-sandbox.vercel.app/login
 * @param {TestDriver} client - TestDriver client
 * @param {string} username - Username (default: 'standard_user')
 * @param {string} password - Password (default: retrieved from screen)
 */
export async function performLogin(client, username = "standard_user", password = null) {
  await client.focusApplication("Google Chrome");

  if (!password) {
    password = await client.remember("the password");
  }

  const usernameField = await client.find(
    "Username, label above the username input field on the login form",
  );
  await usernameField.click();
  await client.type(username);

  await client.pressKeys(["tab"]);
  await client.type(password, { secret: true });

  await client.pressKeys(["tab"]);
  await client.pressKeys(["enter"]);
}

// =============================================================================
// SUITE TEST RUN MANAGEMENT (CI/CD Integration)
// =============================================================================

/**
 * Initialize a test run for the entire suite
 * @param {Object} suiteTask - Vitest suite task context
 * @returns {Promise<Object>} Test run info { runId, testRunDbId, token }
 */
export async function initializeSuiteTestRun(suiteTask) {
  const apiKey = process.env.TD_API_KEY;
  const apiRoot = process.env.TD_API_ROOT || "https://testdriver-api.onrender.com";

  if (!apiKey || !globalThis.__testdriverPlugin) {
    console.log(`[TestHelpers] Skipping suite test run initialization - no API key or plugin`);
    return null;
  }

  const existingRun = globalThis.__testdriverPlugin.getSuiteTestRun(suiteTask.id);
  if (existingRun) {
    console.log(`[TestHelpers] Test run already exists for suite: ${existingRun.runId}`);
    return existingRun;
  }

  try {
    console.log(`[TestHelpers] Initializing test run for suite: ${suiteTask.name}`);

    const token = await globalThis.__testdriverPlugin.authenticateWithApiKey(apiKey, apiRoot);
    console.log(`[TestHelpers] ✅ Authenticated for suite`);

    const runId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const testFile = suiteTask.file?.name || "unknown";
    const testRunData = {
      runId,
      suiteName: suiteTask.name || testFile,
    };

    const testRunResponse = await globalThis.__testdriverPlugin.createTestRunDirect(
      token,
      apiRoot,
      testRunData,
    );
    const testRunDbId = testRunResponse.data?.id;

    const runInfo = { runId, testRunDbId, token };
    globalThis.__testdriverPlugin.setSuiteTestRun(suiteTask.id, runInfo);

    process.env.TD_TEST_RUN_ID = runId;
    process.env.TD_TEST_RUN_DB_ID = testRunDbId;
    process.env.TD_TEST_RUN_TOKEN = token;

    console.log(`[TestHelpers] ✅ Created test run for suite: ${runId} (DB ID: ${testRunDbId})`);
    return runInfo;
  } catch (error) {
    console.error(`[TestHelpers] ❌ Failed to initialize suite test run:`, error.message);
    return null;
  }
}

// =============================================================================
// SETUP/TEARDOWN HELPERS
// =============================================================================

/**
 * Setup function to run before each test
 * @param {TestDriver} client - TestDriver client
 * @param {Object} options - Connection options
 * @returns {Promise<Object>} Sandbox instance
 */
export async function setupTest(client, options = {}) {
  await client.auth();
  const instance = await client.connect({ ...options });

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
  let dashcamUrl = options.dashcamUrl || null;

  console.log("🧹 Running teardown...");

  try {
    if (options.postrun !== false && !dashcamUrl) {
      dashcamUrl = await runPostrun(client);

      if (dashcamUrl && options.task) {
        const replayIdMatch = dashcamUrl.match(/\/replay\/([^?]+)/);
        const replayObjectId = replayIdMatch ? replayIdMatch[1] : null;

        console.log(`🎥 Dashcam URL: ${dashcamUrl}`);
        if (replayObjectId) {
          console.log(`📝 Replay Object ID: ${replayObjectId}`);
        }

        options.task.meta.testdriverDashcamUrl = dashcamUrl;
        options.task.meta.testdriverReplayObjectId = replayObjectId;
        console.log(`[TestHelpers] ✅ Stored dashcam URL in task.meta for test: ${options.task.name}`);
      }
    } else {
      console.log("⏭️  Postrun skipped (disabled in options)");
    }

    // Write test result to temp file for reporter
    if (options.task) {
      const testResultFile = path.join(
        os.tmpdir(),
        "testdriver-results",
        `${options.task.id}.json`,
      );

      try {
        const dir = path.dirname(testResultFile);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const testFile = options.task.file?.filepath || options.task.file?.name || "unknown";
        let testOrder = 0;
        if (options.task.suite && options.task.suite.tasks) {
          testOrder = options.task.suite.tasks.indexOf(options.task);
        }

        const result = options.task.result?.();
        const duration = result?.duration || 0;

        const testResult = {
          testId: options.task.id,
          testName: options.task.name,
          testFile: testFile,
          testOrder: testOrder,
          dashcamUrl: dashcamUrl,
          replayObjectId: dashcamUrl ? dashcamUrl.match(/\/replay\/([^?]+)/)?.[1] : null,
          platform: client.os,
          timestamp: Date.now(),
          duration: duration,
        };

        fs.writeFileSync(testResultFile, JSON.stringify(testResult, null, 2));
        console.log(`[TestHelpers] ✅ Wrote test result to file: ${testResultFile}`);
      } catch (error) {
        console.error(`[TestHelpers] ❌ Failed to write test result file:`, error.message);
      }
    }
  } catch (error) {
    console.error("❌ Error in postrun:", error);
    console.error("❌ Error stack:", error.stack);
  } finally {
    if (options.disconnect !== false) {
      console.log("🔌 Disconnecting client...");
      try {
        await client.disconnect();
        console.log("✅ Client disconnected");
      } catch (disconnectError) {
        console.error("❌ Error disconnecting:", disconnectError.message);
      }
    } else {
      console.log("⏭️  Disconnect skipped (disabled in options)");
    }
  }

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
