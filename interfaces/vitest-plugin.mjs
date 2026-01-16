import { execSync } from "child_process";
import crypto from "crypto";
import { createRequire } from "module";
import path from "path";
import { postOrUpdateTestResults } from "../lib/github-comment.mjs";
import { setTestRunInfo } from "./shared-test-state.mjs";

// Use createRequire to import CommonJS modules without esbuild processing
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
    const vitestPkg = require('vitest/package.json');
    const version = vitestPkg.version;
    const major = parseInt(version.split('.')[0], 10);
    
    if (major < MINIMUM_VITEST_VERSION) {
      throw new Error(
        `TestDriver requires Vitest >= ${MINIMUM_VITEST_VERSION}.0.0, but found ${version}. ` +
        `Please upgrade Vitest: npm install vitest@latest`
      );
    }
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      throw new Error(
        'TestDriver requires Vitest to be installed. ' +
        'Please install it: npm install vitest@latest'
      );
    }
    throw err;
  }
}

// Check Vitest version at plugin load time
checkVitestVersion();

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
  recordedTestCases: [], // Store recorded test case data for GitHub comment
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
  
  // Support TD_OS environment variable for specifying target OS (linux, mac, windows)
  // Priority: test options > plugin options > environment variable > default (linux)
  if (!mergedOptions.os && process.env.TD_OS) {
    mergedOptions.os = process.env.TD_OS;
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
  
  // Connect to sandbox
  await testdriver.auth();
  await testdriver.connect();
  
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
  } catch (error) {
    console.error('Error disconnecting client:', error);
  }
}

/**
 * Handle process termination and mark test run as cancelled
 */
async function handleProcessExit() {
  logger.debug("handleProcessExit called");
  logger.debug("testRun:", !!pluginState.testRun);
  logger.debug("testRunId:", pluginState.testRunId);
  logger.debug("testRunCompleted:", pluginState.testRunCompleted);
  
  if (!pluginState.testRun || !pluginState.testRunId) {
    logger.debug("No test run to cancel - skipping cleanup");
    return;
  }

  // Prevent duplicate completion
  if (pluginState.testRunCompleted) {
    logger.debug("Test run already completed - skipping cancellation");
    return;
  }

  logger.debug("Marking test run as cancelled...");

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

    logger.debug("Calling completeTestRun with:", JSON.stringify(completeData));
    await completeTestRun(completeData);
    pluginState.testRunCompleted = true;
    logger.info("Test run marked as cancelled");
  } catch (error) {
    logger.error("Failed to mark test run as cancelled:", error.message);
  }
}

// Set up process exit handlers
let exitHandlersRegistered = false;
let isExiting = false;
let isCancelling = false; // Track if we're in the process of cancelling due to SIGINT/SIGTERM

function registerExitHandlers() {
  if (exitHandlersRegistered) return;
  exitHandlersRegistered = true;

  // Handle Ctrl+C - use 'once' and prepend to run before Vitest's handler
  process.prependOnceListener("SIGINT", () => {
    logger.debug("SIGINT received, cleaning up...");
    if (isExiting) {
      logger.debug("Already exiting, skipping duplicate handler");
      return;
    }
    isExiting = true;
    isCancelling = true; // Mark that we're cancelling
    
    // Temporarily override process.exit to prevent Vitest from exiting before we're done
    const originalExit = process.exit;
    let exitCalled = false;
    let exitCode = 130;
    
    process.exit = (code) => {
      if (!exitCalled) {
        exitCalled = true;
        exitCode = code ?? 130;
        logger.debug(`process.exit(${exitCode}) called, waiting for cleanup...`);
      }
    };
    
    handleProcessExit()
      .then(() => {
        logger.debug("Cleanup completed successfully");
      })
      .catch((err) => {
        logger.error("Error during SIGINT cleanup:", err.message);
      })
      .finally(() => {
        logger.debug(`Exiting with code ${exitCode}`);
        // Restore and call original exit
        process.exit = originalExit;
        process.exit(exitCode);
      });
  });

  // Handle kill command
  process.prependOnceListener("SIGTERM", () => {
    logger.debug("SIGTERM received, cleaning up...");
    if (isExiting) return;
    isExiting = true;
    isCancelling = true;
    
    const originalExit = process.exit;
    let exitCode = 143;
    
    process.exit = (code) => {
      exitCode = code ?? 143;
    };
    
    handleProcessExit()
      .then(() => {
        logger.debug("Cleanup completed successfully");
      })
      .catch((err) => {
        logger.error("Error during SIGTERM cleanup:", err.message);
      })
      .finally(() => {
        logger.debug(`Exiting with code ${exitCode}`);
        process.exit = originalExit;
        process.exit(exitCode);
      });
  });
  
}

/**
 * Create the TestDriver Vitest plugin
 * This sets up global state and provides the registration API
 */
export default function testDriverPlugin(options = {}) {
  // Store options but don't read env vars yet - they may not be loaded
  // Environment variables will be read in onInit after setupFiles run
  pluginState.apiRoot =
    options.apiRoot || process.env.TD_API_ROOT || "https://testdriver-api.onrender.com";
  pluginState.ciProvider = detectCI();
  pluginState.gitInfo = getGitInfo();

  // Store TestDriver-specific options (excluding plugin-specific ones)
  const { apiKey, apiRoot, ...testDriverOptions } = options;
  pluginState.testDriverOptions = testDriverOptions;

  // Register process exit handlers to handle cancellation
  registerExitHandlers();

  // Note: globalThis setup happens in vitestSetup.mjs for worker processes
  logger.debug("TestDriver plugin initializing...");
  logger.debug("API root:", pluginState.apiRoot);
  logger.debug("API key from options:", !!options.apiKey);
  logger.debug("API key from env (at config time):", !!process.env.TD_API_KEY);
  logger.debug("CI Provider:", pluginState.ciProvider || "none");
  if (Object.keys(testDriverOptions).length > 0) {
    logger.debug("Global TestDriver options:", testDriverOptions);
  }

  // Create reporter instance
  const reporter = new TestDriverReporter(options);
  
  // Add name property for Vitest
  reporter.name = 'testdriver';
  
  return reporter;
}

/**
 * TestDriver Reporter Class
 * Handles Vitest test lifecycle events
 */
class TestDriverReporter {
  constructor(options = {}) {
    this.options = options;
    logger.debug("Reporter created with options:", { hasApiKey: !!options.apiKey, hasApiRoot: !!options.apiRoot });
  }

  async onInit(ctx) {
    this.ctx = ctx;
    logger.debug("onInit called - UPDATED VERSION");

    // Store project root for making file paths relative
    pluginState.projectRoot = ctx.config.root || process.cwd();
    logger.debug("Project root:", pluginState.projectRoot);

    // NOW read the API key and API root (after setupFiles have run, including dotenv/config)
    pluginState.apiKey = this.options.apiKey || process.env.TD_API_KEY;
    pluginState.apiRoot = this.options.apiRoot || process.env.TD_API_ROOT || "https://testdriver-api.onrender.com";
    logger.debug("API key from options:", !!this.options.apiKey);
    logger.debug("API key from env (at onInit):", !!process.env.TD_API_KEY);
    logger.debug("API root from options:", this.options.apiRoot);
    logger.debug("API root from env (at onInit):", process.env.TD_API_ROOT);
    logger.debug("Final API key set:", !!pluginState.apiKey);
    logger.debug("Final API root set:", pluginState.apiRoot);

    // Initialize test run
    await this.initializeTestRun();
  }

  async initializeTestRun() {
    logger.debug("initializeTestRun called");
    logger.debug("API key present:", !!pluginState.apiKey);
    logger.debug("API root:", pluginState.apiRoot);

    // Check if we should enable the reporter
    if (!pluginState.apiKey) {
      logger.warn("No API key provided, skipping test recording");
      logger.debug("API key sources - options:", !!this.options.apiKey, "env:", !!process.env.TD_API_KEY);
      return;
    }

    try {
      // Exchange API key for JWT token
      logger.debug("Authenticating with API...");
      await authenticate();
      logger.debug("Authentication successful, token received");

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

      logger.debug("Creating test run with data:", JSON.stringify(testRunData));
      pluginState.testRun = await createTestRun(testRunData);
      logger.debug("Test run created:", JSON.stringify(pluginState.testRun));

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
    logger.debug("onTestRunEnd called with reason:", reason);
    logger.debug("API key present:", !!pluginState.apiKey);
    logger.debug("Test run present:", !!pluginState.testRun);
    logger.debug("Test run ID:", pluginState.testRunId);
    logger.debug("isCancelling:", isCancelling);
    logger.debug("testRunCompleted:", pluginState.testRunCompleted);

    // If we're cancelling due to SIGINT/SIGTERM, skip - handleProcessExit will handle it
    if (isCancelling) {
      logger.debug("Cancellation in progress via signal handler, skipping onTestRunEnd");
      return;
    }

    // If already completed (by handleProcessExit), skip
    if (pluginState.testRunCompleted) {
      logger.debug("Test run already completed, skipping");
      return;
    }

    if (!pluginState.apiKey) {
      logger.warn("Skipping completion - no API key (was it cleared after init failure?)");
      return;
    }

    if (!pluginState.testRun) {
      logger.warn("Skipping completion - no test run created (check initialization logs)");
      return;
    }

    logger.debug("Completing test run...");

    try {
      // Calculate statistics from testModules
      const stats = calculateStatsFromModules(testModules);

      logger.debug("Stats:", stats);

      // Determine overall status based on stats (not reason, which is unreliable in parallel runs)
      let status = "passed";
      if (stats.failedTests > 0) {
        status = "failed";
      } else if (reason === "interrupted") {
        status = "cancelled";
      } else if (stats.totalTests === 0) {
        status = "cancelled";
      } else if (stats.passedTests === 0 && stats.skippedTests === 0) {
        // No tests actually ran (all were filtered/excluded)
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
      logger.debug(`Platform detection result: ${platform}, detectedPlatform in state: ${pluginState.detectedPlatform}`);
      if (platform) {
        completeData.platform = platform;
        logger.debug(`Updating test run with platform: ${platform}`);
      } else {
        logger.warn(`No platform detected, test run will keep default platform`);
      }

      // Wait for any pending operations (shouldn't be any, but just in case)
      if (pluginState.pendingTestCaseRecords.size > 0) {
        logger.debug(`Waiting for ${pluginState.pendingTestCaseRecords.size} pending operations...`);
        await Promise.all(Array.from(pluginState.pendingTestCaseRecords));
      }

      // Test cases are reported directly from teardownTest
      logger.debug("Calling completeTestRun API...");
      logger.debug("Complete data:", JSON.stringify(completeData));

      const completeResponse = await completeTestRun(completeData);
      logger.debug("API response:", JSON.stringify(completeResponse));

      // Mark test run as completed to prevent duplicate completion
      pluginState.testRunCompleted = true;

      // Output the test run URL for CI to capture
      const testRunDbId = process.env.TD_TEST_RUN_DB_ID;
      const consoleUrl = getConsoleUrl(pluginState.apiRoot);
      if (testRunDbId) {
        const testRunUrl = `${consoleUrl}/runs/${testRunDbId}`;
        logger.info(`View test run: ${testRunUrl}`);
        // Output in a parseable format for CI
        console.log(`TESTDRIVER_RUN_URL=${testRunUrl}`);
        
        // Post GitHub comment if in CI environment
        await postGitHubCommentIfEnabled(testRunUrl, stats, completeData);
      }

      logger.info(`Test run completed: ${stats.passedTests}/${stats.totalTests} passed`);
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

    logger.debug(`Test case completed: ${test.name} (${status})`);

    // Calculate duration from tracked start time
    const testCase = pluginState.testCases.get(test.id);
    const duration = testCase ? Date.now() - testCase.startTime : 0;
    
    logger.debug(`Calculated duration: ${duration}ms (startTime: ${testCase?.startTime}, now: ${Date.now()})`);

    // Read test metadata from Vitest's task.meta (set in test hooks)
    const meta = test.meta();
    logger.debug(`Test meta for ${test.id}:`, meta);

    const dashcamUrl = meta.dashcamUrl || null;
    const sessionId = meta.sessionId || null;
    const platform = meta.platform || null;
    const sandboxId = meta.sandboxId || null;
    let testFile = meta.testFile || "unknown";
    const testOrder = meta.testOrder !== undefined ? meta.testOrder : 0;

    // If testFile not in meta, fallback to test object properties
    if (testFile === "unknown") {
      const absolutePath =
        test.module?.task?.filepath ||
        test.module?.file?.filepath ||
        test.module?.file?.name ||
        test.file?.filepath ||
        test.file?.name ||
        test.suite?.file?.filepath ||
        test.suite?.file?.name ||
        test.location?.file ||
        "unknown";
      testFile = pluginState.projectRoot && absolutePath !== "unknown"
        ? path.relative(pluginState.projectRoot, absolutePath)
        : absolutePath;
      logger.debug(`Resolved testFile from fallback: ${testFile}`);
    }

    // Update test run platform from first test that reports it
    if (platform && !pluginState.detectedPlatform) {
      pluginState.detectedPlatform = platform;
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

      // Store test case data for GitHub comment generation
      pluginState.recordedTestCases.push({
        ...testCaseData,
        id: testCaseDbId,
      });

      console.log('');
      console.log(`🔗 Test Report: ${getConsoleUrl(pluginState.apiRoot)}/runs/${testRunDbId}/${testCaseDbId}`);
    } catch (error) {
      logger.error("Failed to report test case:", error.message);
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Maps an API root URL to its corresponding web console URL.
 * The API and web console are served from different domains/ports.
 * 
 * @param {string} apiRoot - The API root URL (e.g., https://testdriver-api.onrender.com)
 * @returns {string} The corresponding web console URL
 */
function getConsoleUrl(apiRoot) {

  if (!apiRoot) return 'https://console.testdriver.ai';
  
  // Production: API on render.com -> Console on testdriver.ai
  if (apiRoot.includes('testdriver-api.onrender.com')) {
    return 'https://console.testdriver.ai';
  }
  
  // Local development: API on localhost:1337 -> Web on localhost:3001
  if (apiRoot.includes('ngrok.io')) {
    return `http://localhost:3001`;
  }
  
  // Ngrok or other tunnels: assume same host, different path structure
  // For ngrok, the API and web might be on same domain or user needs to configure
  // Return as-is since we can't reliably determine the mapping
  return apiRoot;
}

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

  // Try to get platform from dashcam URLs (registered during test cleanup)
  for (const [, data] of pluginState.dashcamUrls) {
    if (data.platform) {
      logger.debug(`Using platform from dashcam URL registration: ${data.platform}`);
      return data.platform;
    }
  }

  logger.debug("Platform not yet detected from client");
  return null;
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
      logger.debug("Git commit from local:", info.commit);
    } catch (e) {
      logger.debug("Failed to get git commit:", e.message);
    }
  }

  if (!info.branch) {
    try {
      info.branch = execSync("git rev-parse --abbrev-ref HEAD", {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"]
      }).trim();
      logger.debug("Git branch from local:", info.branch);
    } catch (e) {
      logger.debug("Failed to get git branch:", e.message);
    }
  }

  if (!info.author) {
    try {
      info.author = execSync("git config user.name", {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"]
      }).trim();
      logger.debug("Git author from local:", info.author);
    } catch (e) {
      logger.debug("Failed to get git author:", e.message);
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
        logger.debug("Git repo from local:", info.repo);
      }
    } catch (e) {
      logger.debug("Failed to get git repo:", e.message);
    }
  }

  logger.debug("Collected git info:", info);
  return info;
}

// ============================================================================
// GitHub Comment Helper
// ============================================================================

/**
 * Post GitHub comment with test results if enabled
 * Checks for GitHub token and PR number in environment variables
 * @param {string} testRunUrl - URL to the test run
 * @param {Object} stats - Test statistics
 * @param {Object} completeData - Test run completion data
 */
async function postGitHubCommentIfEnabled(testRunUrl, stats, completeData) {
  try {
    // Check if GitHub comments are explicitly disabled
    if (process.env.TESTDRIVER_SKIP_GITHUB_COMMENT === 'true') {
      logger.debug('GitHub comments disabled via TESTDRIVER_SKIP_GITHUB_COMMENT');
      return;
    }
    
    // Check if GitHub comment posting is enabled
    const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    const prNumber = process.env.GITHUB_PR_NUMBER;
    const commitSha = process.env.GITHUB_SHA || pluginState.gitInfo.commit;
    
    // Only post if we have a token and either a PR number or commit SHA
    if (!githubToken) {
      logger.debug('GitHub token not found, skipping comment posting');
      return;
    }
    
    if (!prNumber && !commitSha) {
      logger.debug('Neither PR number nor commit SHA found, skipping comment posting');
      return;
    }
    
    // Extract owner/repo from git info
    const repo = pluginState.gitInfo.repo;
    if (!repo) {
      logger.warn('Repository info not available, skipping GitHub comment');
      return;
    }
    
    const [owner, repoName] = repo.split('/');
    if (!owner || !repoName) {
      logger.warn('Invalid repository format, expected owner/repo');
      return;
    }
    
    logger.debug('Preparing GitHub comment...');
    
    // Prepare test run data for comment
    const testRunData = {
      runId: pluginState.testRunId,
      status: completeData.status,
      totalTests: stats.totalTests,
      passedTests: stats.passedTests,
      failedTests: stats.failedTests,
      skippedTests: stats.skippedTests,
      duration: completeData.duration,
      testRunUrl,
      platform: completeData.platform || pluginState.detectedPlatform || 'unknown',
      branch: pluginState.gitInfo.branch || 'unknown',
      commit: commitSha || 'unknown',
    };
    
    // Use recorded test cases from pluginState
    const testCases = pluginState.recordedTestCases || [];
    
    logger.info(`Posting GitHub comment with ${testCases.length} test cases...`);
    
    // Post or update GitHub comment
    const githubOptions = {
      token: githubToken,
      owner,
      repo: repoName,
      prNumber: prNumber ? parseInt(prNumber, 10) : undefined,
      commitSha: commitSha,
    };
    
    const comment = await postOrUpdateTestResults(testRunData, testCases, githubOptions);
    logger.info(`✅ GitHub comment posted: ${comment.html_url}`);
    console.log(`\n🔗 GitHub Comment: ${comment.html_url}\n`);
    
  } catch (error) {
    logger.warn('Failed to post GitHub comment:', error.message);
    logger.debug('GitHub comment error stack:', error.stack);
  }
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
  logger.debug(`completeTestRun: POSTing to ${url}`);
  
  try {
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

    logger.debug(`completeTestRun: Response status ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const result = await response.json();
    logger.debug(`completeTestRun: Success`);
    return result;
  } catch (error) {
    logger.error(`completeTestRun: Error - ${error.message}`);
    throw error;
  }
}

// Global state setup moved to setup file (vitestSetup.mjs)
// The setup file imports the exported functions and makes them available globally in worker processes
