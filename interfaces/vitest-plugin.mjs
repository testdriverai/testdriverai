import crypto from "crypto";
import { execSync } from "child_process";
import fs from "fs";
import { createRequire } from "module";
import os from "os";
import path from "path";
import { setTestRunInfo } from "./shared-test-state.mjs";

// Use createRequire to import CommonJS modules without esbuild processing
const require = createRequire(import.meta.url);

/**
 * Simple logger for the vitest plugin
 * Supports log levels: debug, info, warn, error
 * Control via TD_LOG_LEVEL environment variable (default: "info")
 * Set TD_LOG_LEVEL=debug for verbose output
 */
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLogLevel = LOG_LEVELS[process.env.TD_LOG_LEVEL?.toLowerCase()] ?? LOG_LEVELS.info;

const logger = {
  debug: (...args) => {
    if (currentLogLevel <= LOG_LEVELS.debug) {
      console.log("[TestDriver]", ...args);
    }
  },
  info: (...args) => {
    if (currentLogLevel <= LOG_LEVELS.info) {
      console.log("[TestDriver]", ...args);
    }
  },
  warn: (...args) => {
    if (currentLogLevel <= LOG_LEVELS.warn) {
      console.warn("[TestDriver]", ...args);
    }
  },
  error: (...args) => {
    if (currentLogLevel <= LOG_LEVELS.error) {
      console.error("[TestDriver]", ...args);
    }
  },
};

/**
 * Timeout wrapper for promises
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operationName - Name of operation for error message
 * @returns {Promise} Promise that rejects if timeout is reached
 */
function withTimeout(promise, timeoutMs, operationName) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ]);
}

/**
 * Vitest Plugin for TestDriver
 *
 * Records test runs, test cases, and associates them with dashcam recordings.
 * Uses plugin architecture for better global state management.
 *
 * ## How it works:
 *
 * 1. **Plugin State**: All state is managed in a single `pluginState` object
 *    - No class instances or complex scoping
 *    - Easy to access from anywhere in the plugin
 *    - Dashcam URLs tracked in memory (no temp files!)
 *
 * 2. **Dashcam URL Registration**: Tests register dashcam URLs via simple API
 *    - `globalThis.__testdriverPlugin.registerDashcamUrl(testId, url, platform)`
 *    - No file system operations
 *    - No complex matching logic
 *    - Direct association via test ID
 *
 * 3. **Test Recording Flow**:
 *    - `onTestRunStart`: Create test run record
 *    - `onTestCaseReady`: Track test start time
 *    - `onTestCaseResult`: Record individual test result (immediate)
 *    - `onTestRunEnd`: Complete test run with final stats
 *
 * 4. **Platform Detection**: Automatically detects platform from SDK client
 *    - No manual configuration needed
 *    - Stored when dashcam URL is registered
 */

// Shared state that can be imported by both the reporter and setup files
export const pluginState = {
  testRun: null,
  testRunId: null,
  testRunCompleted: false,
  client: null,
  startTime: null,
  testCases: new Map(),
  token: null,
  detectedPlatform: null,
  pendingTestCaseRecords: new Set(),
  ciProvider: null,
  gitInfo: {},
  apiKey: null,
  apiRoot: null,
  // TestDriver options to pass to all instances
  testDriverOptions: {},
  // Dashcam URL tracking (in-memory, no files needed!)
  dashcamUrls: new Map(), // testId -> dashcamUrl
  lastDashcamUrl: null, // Fallback for when test ID isn't available
  // Suite-level test run tracking
  suiteTestRuns: new Map(), // suiteId -> { runId, testRunDbId, token }
};

// Export functions that can be used by the reporter or tests
export function registerDashcamUrl(testId, url, platform) {
  logger.debug(`Registering dashcam URL for test ${testId}:`, url);
  pluginState.dashcamUrls.set(testId, { url, platform });
  pluginState.lastDashcamUrl = url;
}

export function getDashcamUrl(testId) {
  return pluginState.dashcamUrls.get(testId);
}

export function clearDashcamUrls() {
  pluginState.dashcamUrls.clear();
  pluginState.lastDashcamUrl = null;
}

export function getSuiteTestRun(suiteId) {
  return pluginState.suiteTestRuns.get(suiteId);
}

export function setSuiteTestRun(suiteId, runData) {
  logger.debug(`Setting test run for suite ${suiteId}:`, runData);
  pluginState.suiteTestRuns.set(suiteId, runData);
}

export function clearSuiteTestRun(suiteId) {
  pluginState.suiteTestRuns.delete(suiteId);
}

export function getPluginState() {
  return pluginState;
}

// Export API helper functions for direct use from tests
export async function authenticateWithApiKey(apiKey, apiRoot) {
  const url = `${apiRoot}/auth/exchange-api-key`;
  const response = await withTimeout(
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ apiKey }),
    }),
    10000,
    "Authentication",
  );

  if (!response.ok) {
    throw new Error(
      `Authentication failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  return data.token;
}

export async function createTestRunDirect(token, apiRoot, testRunData) {
  const url = `${apiRoot}/api/v1/testdriver/test-run-create`;
  const response = await withTimeout(
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(testRunData),
    }),
    10000,
    "Create Test Run",
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `API error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  return await response.json();
}

export async function recordTestCaseDirect(token, apiRoot, testCaseData) {
  const url = `${apiRoot}/api/v1/testdriver/test-case-create`;
  const response = await withTimeout(
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(testCaseData),
    }),
    10000,
    "Record Test Case",
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `API error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  return await response.json();
}

// Import TestDriverSDK using require to avoid esbuild transformation issues
const TestDriverSDK = require('../sdk.js');

/**
 * Create a TestDriver client for use in beforeAll/beforeEach hooks
 * This is for the shared instance pattern where one driver is used across multiple tests
 * 
 * @param {object} options - TestDriver options
 * @param {string} [options.apiKey] - TestDriver API key (defaults to process.env.TD_API_KEY)
 * @param {boolean} [options.headless] - Run sandbox in headless mode
 * @returns {Promise<TestDriver>} Connected TestDriver client instance
 * 
 * @example
 * let testdriver;
 * beforeAll(async () => {
 *   testdriver = await createTestDriver({ headless: true });
 *   await testdriver.provision.chrome({ url: 'https://example.com' });
 * });
 */
export async function createTestDriver(options = {}) {
  // Get global plugin options if available
  const pluginOptions = globalThis.__testdriverPlugin?.state?.testDriverOptions || {};
  
  // Merge options: plugin global options < test-specific options
  const mergedOptions = { ...pluginOptions, ...options };
  
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
  
  // Connect to sandbox
  console.log('[testdriver] Connecting to sandbox...');
  await testdriver.auth();
  await testdriver.connect();
  console.log('[testdriver] ✅ Connected to sandbox');
  
  return testdriver;
}

/**
 * Register a test with a shared TestDriver instance
 * Call this at the start of each test to associate the test context with the driver
 * 
 * @param {TestDriver} testdriver - TestDriver client instance from createTestDriver
 * @param {object} context - Vitest test context (from async (context) => {})
 * 
 * @example
 * it("step01: verify login", async (context) => {
 *   registerTest(testdriver, context);
 *   const result = await testdriver.assert("login form visible");
 * });
 */
export function registerTest(testdriver, context) {
  if (!testdriver) {
    throw new Error('registerTest() requires a TestDriver instance');
  }
  if (!context || !context.task) {
    throw new Error('registerTest() requires Vitest context. Pass the context parameter from your test function.');
  }
  
  testdriver.__vitestContext = context.task;
  logger.debug(`Registered test: ${context.task.name}`);
}

/**
 * Clean up a TestDriver client created with createTestDriver
 * Call this in afterAll to properly disconnect and stop recordings
 * 
 * @param {TestDriver} testdriver - TestDriver client instance
 * 
 * @example
 * afterAll(async () => {
 *   await cleanupTestDriver(testdriver);
 * });
 */
export async function cleanupTestDriver(testdriver) {
  if (!testdriver) {
    return;
  }
  
  console.log('[testdriver] Cleaning up TestDriver client...');
  
  try {
    // Stop dashcam if it was started
    if (testdriver._dashcam && testdriver._dashcam.recording) {
      try {
        const dashcamUrl = await testdriver.dashcam.stop();
        console.log('🎥 Dashcam URL:', dashcamUrl);
        
        // Register dashcam URL in memory for the reporter
        if (dashcamUrl && globalThis.__testdriverPlugin?.registerDashcamUrl) {
          const testId = testdriver.__vitestContext?.id || 'unknown';
          const platform = testdriver.os || 'linux';
          globalThis.__testdriverPlugin.registerDashcamUrl(testId, dashcamUrl, platform);
        }
      } catch (error) {
        console.error('❌ Failed to stop dashcam:', error.message);
        if (error.name === 'NotFoundError' || error.responseData?.error === 'NotFoundError') {
          console.log('   ℹ️  Sandbox session already terminated - dashcam stop skipped');
        }
      }
    }
    
    await testdriver.disconnect();
    console.log('✅ Client disconnected');
  } catch (error) {
    console.error('Error disconnecting client:', error);
  }
}

/**
 * Handle process termination and mark test run as cancelled
 */
async function handleProcessExit() {
  if (!pluginState.testRun || !pluginState.testRunId) {
    return;
  }

  logger.info("Process interrupted, marking test run as cancelled...");

  try {
    const stats = {
      totalTests: pluginState.testCases.size,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
    };

    const completeData = {
      runId: pluginState.testRunId,
      status: "cancelled",
      totalTests: stats.totalTests,
      passedTests: stats.passedTests,
      failedTests: stats.failedTests,
      skippedTests: stats.skippedTests,
      duration: Date.now() - pluginState.startTime,
    };

    // Update platform if detected
    const platform = getPlatform();
    if (platform) {
      completeData.platform = platform;
    }

    await completeTestRun(completeData);
    logger.info("✅ Test run marked as cancelled");
  } catch (error) {
    logger.error("Failed to mark test run as cancelled:", error.message);
  }
}

// Set up process exit handlers
let exitHandlersRegistered = false;

function registerExitHandlers() {
  if (exitHandlersRegistered) return;
  exitHandlersRegistered = true;

  // Handle Ctrl+C
  process.on("SIGINT", async () => {
    await handleProcessExit();
    process.exit(130); // Standard exit code for SIGINT
  });

  // Handle kill command
  process.on("SIGTERM", async () => {
    await handleProcessExit();
    process.exit(143); // Standard exit code for SIGTERM
  });

  // Handle unexpected exits
  process.on("beforeExit", async () => {
    // Only handle if test run is still running (hasn't been completed normally)
    if (pluginState.testRun && !pluginState.testRunCompleted) {
      await handleProcessExit();
    }
  });
}

/**
 * Create the TestDriver Vitest plugin
 * This sets up global state and provides the registration API
 */
export default function testDriverPlugin(options = {}) {
  // Initialize plugin state with options
  pluginState.apiKey = options.apiKey;
  pluginState.apiRoot =
    options.apiRoot || process.env.TD_API_ROOT || "http://localhost:1337";
  pluginState.ciProvider = detectCI();
  pluginState.gitInfo = getGitInfo();
  
  // Store TestDriver-specific options (excluding plugin-specific ones)
  const { apiKey, apiRoot, ...testDriverOptions } = options;
  pluginState.testDriverOptions = testDriverOptions;

  // Register process exit handlers to handle cancellation
  registerExitHandlers();

  // Note: globalThis setup happens in vitestSetup.mjs for worker processes
  logger.debug("Initialized with API root:", pluginState.apiRoot);
  if (Object.keys(testDriverOptions).length > 0) {
    logger.debug("Global TestDriver options:", testDriverOptions);
  }

  return new TestDriverReporter(options);
}

/**
 * TestDriver Reporter Class
 * Handles Vitest test lifecycle events
 */
class TestDriverReporter {
  constructor(options = {}) {
    this.options = options;
    logger.debug("Reporter created");
  }

  async onInit(ctx) {
    this.ctx = ctx;
    logger.debug("onInit called");

    // Initialize test run
    await this.initializeTestRun();
  }

  async initializeTestRun() {
    logger.debug("Initializing test run...");

    // Check if we should enable the reporter
    if (!pluginState.apiKey) {
      logger.debug("No API key provided, skipping test recording");
      return;
    }

    try {
      // Exchange API key for JWT token
      await authenticate();

      // Generate unique run ID
      pluginState.testRunId = generateRunId();
      pluginState.startTime = Date.now();
      pluginState.testRunCompleted = false; // Reset completion flag

      // Create test run via direct API call
      const testRunData = {
        runId: pluginState.testRunId,
        suiteName: getSuiteName(),
        ...pluginState.gitInfo,
      };

      // Session ID will be added from the first test result file that includes it

      // Only add ciProvider if it's not null
      if (pluginState.ciProvider) {
        testRunData.ciProvider = pluginState.ciProvider;
      }

      // Platform will be set from the first test result file
      // Default to linux if no tests write platform info
      testRunData.platform = "linux";

      pluginState.testRun = await createTestRun(testRunData);

      // Store in environment variables for worker processes to access
      process.env.TD_TEST_RUN_ID = pluginState.testRunId;
      process.env.TD_TEST_RUN_DB_ID = pluginState.testRun.data?.id || "";
      process.env.TD_TEST_RUN_TOKEN = pluginState.token;

      // Also store in shared state module (won't work across processes but good for main)
      setTestRunInfo({
        testRun: pluginState.testRun,
        testRunId: pluginState.testRunId,
        token: pluginState.token,
        apiKey: pluginState.apiKey,
        apiRoot: pluginState.apiRoot,
        startTime: pluginState.startTime,
      });

      logger.info(`Test run created: ${pluginState.testRunId}`);
    } catch (error) {
      logger.error("Failed to initialize:", error.message);
      pluginState.apiKey = null;
      pluginState.token = null;
    }
  }

  async onTestRunEnd(testModules, unhandledErrors, reason) {
    logger.debug("Test run ending with reason:", reason);

    if (!pluginState.apiKey) {
      logger.debug("Skipping completion - no API key");
      return;
    }

    if (!pluginState.testRun) {
      logger.debug("Skipping completion - no test run created");
      return;
    }

    try {
      // Calculate statistics from testModules
      const stats = calculateStatsFromModules(testModules);

      logger.debug("Stats:", stats);

      // Determine overall status based on reason and stats
      let status = "passed";
      if (reason === "failed" || stats.failedTests > 0) {
        status = "failed";
      } else if (reason === "interrupted") {
        status = "cancelled";
      } else if (stats.totalTests === 0) {
        status = "cancelled";
      }

      // Complete test run via API
      logger.debug(`Completing test run ${pluginState.testRunId} with status: ${status}`);

      const completeData = {
        runId: pluginState.testRunId,
        status,
        totalTests: stats.totalTests,
        passedTests: stats.passedTests,
        failedTests: stats.failedTests,
        skippedTests: stats.skippedTests,
        duration: Date.now() - pluginState.startTime,
      };

      // Update platform if detected from test results
      const platform = getPlatform();
      if (platform) {
        completeData.platform = platform;
        logger.debug(`Updating test run with platform: ${platform}`);
      }

      // Wait for any pending operations (shouldn't be any, but just in case)
      if (pluginState.pendingTestCaseRecords.size > 0) {
        logger.debug(`Waiting for ${pluginState.pendingTestCaseRecords.size} pending operations...`);
        await Promise.all(Array.from(pluginState.pendingTestCaseRecords));
      }

      // Test cases are reported directly from teardownTest
      logger.debug("All test cases reported from teardown");

      const completeResponse = await completeTestRun(completeData);
      logger.debug("Test run completion API response:", completeResponse);

      // Mark test run as completed to prevent duplicate completion
      pluginState.testRunCompleted = true;

      logger.info(`✅ Test run completed: ${stats.passedTests}/${stats.totalTests} passed`);
    } catch (error) {
      logger.error("Failed to complete test run:", error.message);
      logger.debug("Error stack:", error.stack);
    }
  }

  onTestCaseReady(test) {
    if (!pluginState.apiKey || !pluginState.testRun) return;

    pluginState.testCases.set(test.id, {
      test,
      startTime: Date.now(),
    });

    // Try to detect platform from test context
    detectPlatformFromTest(test);
  }

  async onTestCaseResult(test) {
    if (!pluginState.apiKey || !pluginState.testRun) return;

    const result = test.result();
    const status =
      result.state === "passed"
        ? "passed"
        : result.state === "skipped"
          ? "skipped"
          : "failed";

    logger.info(`Test case completed: ${test.name} (${status})`);

    // Calculate duration from tracked start time
    const testCase = pluginState.testCases.get(test.id);
    const duration = testCase ? Date.now() - testCase.startTime : 0;
    
    logger.debug(`Calculated duration: ${duration}ms (startTime: ${testCase?.startTime}, now: ${Date.now()})`);

    // Read test metadata from file (cross-process communication)
    let dashcamUrl = null;
    let sessionId = null;
    let testFile = "unknown";
    let testOrder = 0;

    const testResultFile = path.join(
      os.tmpdir(),
      "testdriver-results",
      `${test.id}.json`,
    );

    logger.debug(`Looking for test result file with test.id: ${test.id}`);
    logger.debug(`Test result file path: ${testResultFile}`);

    try {
      if (fs.existsSync(testResultFile)) {
        const testResult = JSON.parse(fs.readFileSync(testResultFile, "utf-8"));
        dashcamUrl = testResult.dashcamUrl || null;
        const platform = testResult.platform || null;
        sessionId = testResult.sessionId || null;
        testFile =
          testResult.testFile ||
          test.file?.filepath ||
          test.file?.name ||
          "unknown";
        testOrder =
          testResult.testOrder !== undefined ? testResult.testOrder : 0;
        // Don't override duration from file - use Vitest's result.duration
        // duration is already set above from result.duration

        logger.debug(`Read from file - dashcam: ${dashcamUrl}, platform: ${platform}, sessionId: ${sessionId}, testFile: ${testFile}, testOrder: ${testOrder}, duration: ${duration}ms`);

        // Update test run platform from first test that reports it
        if (platform && !pluginState.detectedPlatform) {
          pluginState.detectedPlatform = platform;
          logger.debug(`Detected platform from test: ${platform}`);
        }

        // Clean up the file after reading
        try {
          fs.unlinkSync(testResultFile);
        } catch {
          // Ignore cleanup errors
        }
      } else {
        logger.debug(`No result file found for test: ${test.id}`);
        // Fallback to test object properties - try multiple sources
        // In Vitest, the file path is on test.module.task.filepath
        testFile =
          test.module?.task?.filepath ||
          test.module?.file?.filepath ||
          test.module?.file?.name ||
          test.file?.filepath ||
          test.file?.name ||
          test.suite?.file?.filepath ||
          test.suite?.file?.name ||
          test.location?.file ||
          "unknown";
        logger.debug(`Resolved testFile: ${testFile}`);
      }
    } catch (error) {
      logger.error("Failed to read test result file:", error.message);
      // Fallback to test object properties - try multiple sources
      // In Vitest, the file path is on test.module.task.filepath
      testFile =
        test.module?.task?.filepath ||
        test.module?.file?.filepath ||
        test.module?.file?.name ||
        test.file?.filepath ||
        test.file?.name ||
        test.suite?.file?.filepath ||
        test.suite?.file?.name ||
        test.location?.file ||
        "unknown";
      logger.debug(`Resolved testFile from fallback: ${testFile}`);
    }

    // Get test run info from environment variables
    const testRunId = process.env.TD_TEST_RUN_ID;
    const token = process.env.TD_TEST_RUN_TOKEN;

    if (!testRunId || !token) {
      logger.warn(`Test run not initialized, skipping test case recording for: ${test.name}`);
      return;
    }

    try {
      let errorMessage = null;
      let errorStack = null;

      if (
        result.state === "failed" &&
        result.errors &&
        result.errors.length > 0
      ) {
        const error = result.errors[0];
        errorMessage = error.message;
        errorStack = error.stack;
      }

      const suiteName = test.suite?.name;
      const startTime = Date.now() - duration; // Calculate start time from duration

      // Record test case with all metadata
      const testCaseData = {
        runId: testRunId,
        testName: test.name,
        testFile: testFile,
        testOrder: testOrder,
        status,
        startTime: startTime,
        endTime: Date.now(),
        duration: duration,
        retries: result.retryCount || 0,
      };

      // Add sessionId if available
      if (sessionId) {
        testCaseData.sessionId = sessionId;
      }

      // Only include replayUrl if we have a valid dashcam URL
      if (dashcamUrl) {
        testCaseData.replayUrl = dashcamUrl;
      }

      if (suiteName) testCaseData.suiteName = suiteName;
      if (errorMessage) testCaseData.errorMessage = errorMessage;
      if (errorStack) testCaseData.errorStack = errorStack;

      logger.debug(`Recording test case: ${test.name} (${status}) with testFile: ${testFile}, testOrder: ${testOrder}, duration: ${duration}ms, replay: ${dashcamUrl ? "yes" : "no"}`);

      const testCaseResponse = await recordTestCaseDirect(
        token,
        pluginState.apiRoot,
        testCaseData,
      );

      const testCaseDbId = testCaseResponse.data?.id;
      const testRunDbId = process.env.TD_TEST_RUN_DB_ID;

      logger.debug(`Reported test case to API${dashcamUrl ? " with dashcam URL" : ""}`);
      logger.info(`🔗 View test: ${pluginState.apiRoot.replace("testdriver-api.onrender.com", "app.testdriver.ai")}/runs/${testRunDbId}/${testCaseDbId}`);
    } catch (error) {
      logger.error("Failed to report test case:", error.message);
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateRunId() {
  return `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

function getSuiteName() {
  return process.env.npm_package_name || path.basename(process.cwd());
}

function getPlatform() {
  // First try to get platform from SDK client detected during test execution
  if (pluginState.detectedPlatform) {
    logger.debug(`Using platform from SDK client: ${pluginState.detectedPlatform}`);
    return pluginState.detectedPlatform;
  }

  logger.debug("Platform not yet detected from client");
  return null;
}

function detectPlatformFromTest(test) {
  // Check if testdriver client is accessible via test context
  const client = test.context?.testdriver || test.meta?.testdriver;

  if (client && client.os) {
    // Normalize platform value
    let platform = client.os.toLowerCase();
    if (platform === "darwin" || platform === "mac") platform = "mac";
    else if (platform === "win32" || platform === "windows")
      platform = "windows";
    else if (platform === "linux") platform = "linux";

    pluginState.detectedPlatform = platform;
    logger.debug(`Detected platform from test context: ${platform}`);
  }
}

function calculateStatsFromModules(testModules) {
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let skippedTests = 0;

  for (const testModule of testModules) {
    for (const testCase of testModule.children.allTests()) {
      totalTests++;
      const result = testCase.result();
      if (result.state === "passed") passedTests++;
      else if (result.state === "failed") failedTests++;
      else if (result.state === "skipped") skippedTests++;
    }
  }

  return { totalTests, passedTests, failedTests, skippedTests };
}

function detectCI() {
  if (process.env.GITHUB_ACTIONS) return "github";
  if (process.env.GITLAB_CI) return "gitlab";
  if (process.env.CIRCLECI) return "circle";
  if (process.env.TRAVIS) return "travis";
  if (process.env.JENKINS_URL) return "jenkins";
  if (process.env.BUILDKITE) return "buildkite";
  return null;
}

function getGitInfo() {
  const info = {};

  if (process.env.GITHUB_ACTIONS) {
    if (process.env.GITHUB_REPOSITORY)
      info.repo = process.env.GITHUB_REPOSITORY;
    if (process.env.GITHUB_REF_NAME) info.branch = process.env.GITHUB_REF_NAME;
    if (process.env.GITHUB_SHA) info.commit = process.env.GITHUB_SHA;
    if (process.env.GITHUB_ACTOR) info.author = process.env.GITHUB_ACTOR;
  } else if (process.env.GITLAB_CI) {
    if (process.env.CI_PROJECT_PATH) info.repo = process.env.CI_PROJECT_PATH;
    if (process.env.CI_COMMIT_BRANCH)
      info.branch = process.env.CI_COMMIT_BRANCH;
    if (process.env.CI_COMMIT_SHA) info.commit = process.env.CI_COMMIT_SHA;
    if (process.env.GITLAB_USER_LOGIN)
      info.author = process.env.GITLAB_USER_LOGIN;
  } else if (process.env.CIRCLECI) {
    if (
      process.env.CIRCLE_PROJECT_USERNAME &&
      process.env.CIRCLE_PROJECT_REPONAME
    ) {
      info.repo = `${process.env.CIRCLE_PROJECT_USERNAME}/${process.env.CIRCLE_PROJECT_REPONAME}`;
    }
    if (process.env.CIRCLE_BRANCH) info.branch = process.env.CIRCLE_BRANCH;
    if (process.env.CIRCLE_SHA1) info.commit = process.env.CIRCLE_SHA1;
    if (process.env.CIRCLE_USERNAME) info.author = process.env.CIRCLE_USERNAME;
  }

  // If not in CI or if commit info is missing, try to get it from local git
  if (!info.commit) {
    try {
      info.commit = execSync("git rev-parse HEAD", {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"]
      }).trim();
    } catch (e) {
      // Git command failed, ignore
    }
  }

  if (!info.branch) {
    try {
      info.branch = execSync("git rev-parse --abbrev-ref HEAD", {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"]
      }).trim();
    } catch (e) {
      // Git command failed, ignore
    }
  }

  if (!info.author) {
    try {
      info.author = execSync("git config user.name", {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"]
      }).trim();
    } catch (e) {
      // Git command failed, ignore
    }
  }

  if (!info.repo) {
    try {
      const remoteUrl = execSync("git config --get remote.origin.url", {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"]
      }).trim();

      // Extract repo from git URL (supports both SSH and HTTPS)
      // SSH: git@github.com:user/repo.git
      // HTTPS: https://github.com/user/repo.git
      const match = remoteUrl.match(/[:/]([^/:]+\/[^/:]+?)(\.git)?$/);
      if (match) {
        info.repo = match[1];
      }
    } catch (e) {
      // Git command failed, ignore
    }
  }

  return info;
}

// ============================================================================
// API Methods
// ============================================================================

async function authenticate() {
  const url = `${pluginState.apiRoot}/auth/exchange-api-key`;
  const response = await withTimeout(
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiKey: pluginState.apiKey,
      }),
    }),
    10000,
    "Internal Authentication",
  );

  if (!response.ok) {
    throw new Error(
      `Authentication failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  pluginState.token = data.token;
}

async function createTestRun(data) {
  const url = `${pluginState.apiRoot}/api/v1/testdriver/test-run-create`;
  const response = await withTimeout(
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pluginState.token}`,
      },
      body: JSON.stringify(data),
    }),
    10000,
    "Internal Create Test Run",
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `API error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  return await response.json();
}

async function completeTestRun(data) {
  const url = `${pluginState.apiRoot}/api/v1/testdriver/test-run-complete`;
  const response = await withTimeout(
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pluginState.token}`,
      },
      body: JSON.stringify(data),
    }),
    10000,
    "Internal Complete Test Run",
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `API error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  return await response.json();
}

// Global state setup moved to setup file (vitestSetup.mjs)
// The setup file imports the exported functions and makes them available globally in worker processes
