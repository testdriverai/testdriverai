import crypto from "crypto";
import path from "path";

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
  // Dashcam URL tracking (in-memory, no files needed!)
  dashcamUrls: new Map(), // testId -> dashcamUrl
  lastDashcamUrl: null, // Fallback for when test ID isn't available
};

// Export functions that can be used by the reporter or tests
export function registerDashcamUrl(testId, url, platform) {
  console.log(`[Plugin] Registering dashcam URL for test ${testId}:`, url);
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

// Export API helper functions for direct use from tests
export async function authenticateWithApiKey(apiKey, apiRoot) {
  const url = `${apiRoot}/auth/exchange-api-key`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ apiKey }),
  });

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
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(testRunData),
  });

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
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(testCaseData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `API error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  return await response.json();
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

  // Note: globalThis setup happens in vitestSetup.mjs for worker processes
  console.log(
    "[TestDriver Plugin] Initialized with API root:",
    pluginState.apiRoot,
  );

  return new TestDriverReporter(options);
}

/**
 * TestDriver Reporter Class
 * Handles Vitest test lifecycle events
 */
class TestDriverReporter {
  constructor(options = {}) {
    this.options = options;
    console.log("[TestDriver Reporter] Created");
  }

  onInit(ctx) {
    this.ctx = ctx;
    console.log("[TestDriver Reporter] onInit called");
  }

  async onTestRunStart() {
    console.log("[TestDriver Reporter] Test run starting...");

    // Check if we should enable the reporter
    if (!pluginState.apiKey) {
      console.log(
        "[TestDriver Reporter] No API key provided, skipping test recording",
      );
      return;
    }

    try {
      // Exchange API key for JWT token
      await authenticate();

      // Generate unique run ID
      pluginState.testRunId = generateRunId();
      pluginState.startTime = Date.now();

      // Create test run via direct API call
      const testRunData = {
        runId: pluginState.testRunId,
        suiteName: getSuiteName(),
        ...pluginState.gitInfo,
      };

      // Only add ciProvider if it's not null
      if (pluginState.ciProvider) {
        testRunData.ciProvider = pluginState.ciProvider;
      }

      pluginState.testRun = await createTestRun(testRunData);

      console.log(
        `[TestDriver Reporter] Test run created: ${pluginState.testRunId}`,
      );
    } catch (error) {
      console.error(
        "[TestDriver Reporter] Failed to initialize:",
        error.message,
      );
      pluginState.apiKey = null;
      pluginState.token = null;
    }
  }

  async onTestRunEnd(testModules, unhandledErrors, reason) {
    console.log("[TestDriver Reporter] Test run ending with reason:", reason);

    if (!pluginState.apiKey) {
      console.log("[TestDriver Reporter] Skipping completion - no API key");
      return;
    }

    if (!pluginState.testRun) {
      console.log(
        "[TestDriver Reporter] Skipping completion - no test run created",
      );
      return;
    }

    try {
      // Calculate statistics from testModules
      const stats = calculateStatsFromModules(testModules);

      console.log(`[TestDriver Reporter] Stats:`, stats);

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
      console.log(
        `[TestDriver Reporter] Completing test run ${pluginState.testRunId} with status: ${status}`,
      );

      const completeData = {
        runId: pluginState.testRunId,
        status,
        totalTests: stats.totalTests,
        passedTests: stats.passedTests,
        failedTests: stats.failedTests,
        skippedTests: stats.skippedTests,
        duration: Date.now() - pluginState.startTime,
      };

      // Add platform if detected from client
      const platform = getPlatform();
      if (platform) {
        completeData.platform = platform;
      }

      // Wait for any pending operations (shouldn't be any, but just in case)
      if (pluginState.pendingTestCaseRecords.size > 0) {
        console.log(
          `[TestDriver Reporter] Waiting for ${pluginState.pendingTestCaseRecords.size} pending operations...`,
        );
        await Promise.all(Array.from(pluginState.pendingTestCaseRecords));
      }

      // Test cases are reported directly from teardownTest
      console.log(
        `[TestDriver Reporter] All test cases reported from teardown`,
      );

      await completeTestRun(completeData);

      console.log(
        `[TestDriver Reporter] Test run completed: ${stats.passedTests}/${stats.totalTests} passed`,
      );
    } catch (error) {
      console.error(
        "[TestDriver Reporter] Failed to complete test run:",
        error.message,
      );
      console.error("[TestDriver Reporter] Error stack:", error.stack);
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

    // Just track test completion for stats
    // Test cases are reported directly from teardownTest when we have the dashcam URL
    console.log(
      `[TestDriver Reporter] Test case completed: ${test.name} (${test.result().state})`,
    );
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
    console.log(
      `[TestDriver Plugin] Using platform from SDK client: ${pluginState.detectedPlatform}`,
    );
    return pluginState.detectedPlatform;
  }

  console.log(`[TestDriver Plugin] Platform not yet detected from client`);
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
    console.log(
      `[TestDriver Plugin] Detected platform from test context: ${platform}`,
    );
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

  return info;
}

// ============================================================================
// API Methods
// ============================================================================

async function authenticate() {
  const url = `${pluginState.apiRoot}/auth/exchange-api-key`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apiKey: pluginState.apiKey,
    }),
  });

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
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${pluginState.token}`,
    },
    body: JSON.stringify(data),
  });

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
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${pluginState.token}`,
    },
    body: JSON.stringify(data),
  });

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
