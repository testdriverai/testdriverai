const crypto = require("crypto");
const path = require("path");

/**
 * Vitest Reporter for TestDriver
 * 
 * Records test runs, test cases, and associates them with dashcam recordings.
 */
class TestDriverReporter {
  constructor(options = {}) {
    this.options = options;
    this.testRun = null;
    this.testRunId = null;
    this.client = null;
    this.startTime = null;
    this.testCases = new Map();
    this.token = null; // JWT token for API authentication
    this.detectedPlatform = null; // Platform detected from test execution
    
    // CI/CD detection
    this.ciProvider = this._detectCI();
    this.gitInfo = this._getGitInfo();
  }

  onInit(ctx) {
    // Store context for later use
    this.ctx = ctx;
    console.log("[TestDriver Reporter] onInit called");
  }

  /**
   * Called when test run starts (Vitest 4.x hook)
   */
  async onTestRunStart() {
    console.log("[TestDriver Reporter] onTestRunStart called");
    
    // Check if we should enable the reporter
    if (!this.options.apiKey) {
      console.log("[TestDriver Reporter] No API key provided in options, skipping test recording");
      return;
    }

    try {
      this.apiKey = this.options.apiKey;
      this.apiRoot = this.options.apiRoot || process.env.TD_API_ROOT || "http://localhost:1337";

      // Exchange API key for JWT token
      await this._authenticate();

      // Generate unique run ID
      this.testRunId = this._generateRunId();
      this.startTime = Date.now();

      // Create test run via direct API call
      // Note: platform will be set during completion once we detect it from the client
      const testRunData = {
        runId: this.testRunId,
        suiteName: this._getSuiteName(),
        ...this.gitInfo
      };
      
      // Only add ciProvider if it's not null
      if (this.ciProvider) {
        testRunData.ciProvider = this.ciProvider;
      }
      
      this.testRun = await this._createTestRun(testRunData);

      console.log(`[TestDriver Reporter] Test run created: ${this.testRunId}`);

    } catch (error) {
      console.error("[TestDriver Reporter] Failed to initialize:", error.message);
      this.apiKey = null;
      this.token = null;
    }
  }

  /**
   * Called when test run ends (Vitest 4.x hook)
   */
  async onTestRunEnd(testModules, unhandledErrors, reason) {
    console.log("[TestDriver Reporter] onTestRunEnd called with reason:", reason);
    
    if (!this.apiKey) {
      console.log("[TestDriver Reporter] Skipping completion - no API key");
      return;
    }
    
    if (!this.testRun) {
      console.log("[TestDriver Reporter] Skipping completion - no test run created");
      return;
    }

    try {
      // Calculate statistics from testModules
      const stats = this._calculateStatsFromModules(testModules);
      
      console.log(`[TestDriver Reporter] Stats:`, stats);

      // Determine overall status based on reason and stats
      let status = "passed";
      if (reason === 'failed' || stats.failedTests > 0) {
        status = "failed";
      } else if (reason === 'interrupted') {
        status = "cancelled";
      } else if (stats.totalTests === 0) {
        status = "cancelled";
      }

      // Complete test run via API
      console.log(`[TestDriver Reporter] Completing test run ${this.testRunId} with status: ${status}`);
      
      const completeData = {
        runId: this.testRunId,
        status,
        totalTests: stats.totalTests,
        passedTests: stats.passedTests,
        failedTests: stats.failedTests,
        skippedTests: stats.skippedTests,
        duration: Date.now() - this.startTime,
      };
      
      // Add platform if detected from client
      const platform = this._getPlatform();
      if (platform) {
        completeData.platform = platform;
      }
      
      await this._completeTestRun(completeData);

      console.log(`[TestDriver Reporter] Test run completed: ${stats.passedTests}/${stats.totalTests} passed`);

    } catch (error) {
      console.error("[TestDriver Reporter] Failed to complete test run:", error.message);
      console.error("[TestDriver Reporter] Error stack:", error.stack);
    }
  }

  /**
   * Called when each test begins (Vitest 4.x: onTestCaseReady)
   */
  onTestCaseReady(test) {
    
    if (!this.apiKey || !this.testRun) return;

    this.testCases.set(test.id, {
      test,
      startTime: Date.now(),
    });
    
    // Try to detect platform from test context
    this._detectPlatformFromTest(test);
  }

  /**
   * Called when each test completes (Vitest 4.x: onTestCaseResult)
   */
  async onTestCaseResult(test) {
    
    if (!this.apiKey || !this.testRun) return;

    const testId = test.id;
    const testData = this.testCases.get(testId);
    
    if (!testData) {
      // Store start time if we didn't catch it in onTestCaseReady
      this.testCases.set(testId, {
        test,
        startTime: Date.now() - (test.result()?.duration || 0),
      });
    }

    const startTime = testData?.startTime || Date.now();
    const endTime = Date.now();
    const duration = test.result()?.duration || (endTime - startTime);

    try {
      // Get test result using Vitest 4.x API
      const result = test.result();
      
      // Determine status
      let status = "passed";
      let errorMessage = null;
      let errorStack = null;

      if (result.state === "failed") {
        status = "failed";
        if (result.errors && result.errors.length > 0) {
          const error = result.errors[0];
          errorMessage = error.message;
          errorStack = error.stack;
        }
      } else if (result.state === "skipped") {
        status = "skipped";
      }

      // Try to find associated dashcam replay
      const replayUrl = await this._findReplayForTest(test);

      // Get test file path and name using Vitest 4.x API
      const testFile = test.module?.relativeModuleId || test.file?.name || 'unknown';
      const suiteName = test.suite?.name;

      // Build test case data, only including defined values
      const testCaseData = {
        runId: this.testRunId,
        testName: test.name,
        testFile,
        status,
        startTime,
        endTime,
        duration,
        retries: result.retryCount || 0,
      };

      // Only add optional fields if they have values
      if (suiteName) testCaseData.suiteName = suiteName;
      if (errorMessage) testCaseData.errorMessage = errorMessage;
      if (errorStack) testCaseData.errorStack = errorStack;
      if (replayUrl) testCaseData.replayUrl = replayUrl;

      // Record test case via API
      await this._recordTestCase(testCaseData);
    } catch (error) {
      console.error(
        `[TestDriver Reporter] Failed to record test case "${test.name}":`,
        error.message
      );
    }
  }



  // Helper methods
  _generateRunId() {
    return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  _getSuiteName() {
    return process.env.npm_package_name || path.basename(process.cwd());
  }

  _getPlatform() {
    // First try to get platform from SDK client detected during test execution
    if (this.detectedPlatform) {
      console.log(`[TestDriver Reporter] Using platform from SDK client: ${this.detectedPlatform}`);
      return this.detectedPlatform;
    }
    
    // Try to detect from global registry (check any registered client)
    if (globalThis.__testdriverRegistry && globalThis.__testdriverRegistry.clients.size > 0) {
      const firstClient = globalThis.__testdriverRegistry.clients.values().next().value;
      if (firstClient && firstClient.os) {
        const platform = firstClient.os.toLowerCase();
        console.log(`[TestDriver Reporter] Using platform from global registry client: ${platform}`);
        this.detectedPlatform = platform; // Cache it
        return platform;
      }
    }
    
    console.log(`[TestDriver Reporter] Platform not yet detected from client`);
    return null;
  }
  
  /**
   * Try to detect platform from test context
   * @private
   * @param {Object} test - Vitest test object
   */
  _detectPlatformFromTest(test) {
    // Check if testdriver client is accessible via test context
    // Tests might store the client in test.context.testdriver or similar
    const client = test.context?.testdriver || test.meta?.testdriver;
    
    if (client && client.os) {
      // Normalize platform value
      let platform = client.os.toLowerCase();
      if (platform === 'darwin' || platform === 'mac') platform = 'mac';
      else if (platform === 'win32' || platform === 'windows') platform = 'windows';
      else if (platform === 'linux') platform = 'linux';
      
      this.detectedPlatform = platform;
      console.log(`[TestDriver Reporter] Detected platform from test context: ${platform}`);
    }
  }

  _getTestId(test) {
    return `${test.file?.filepath}::${test.name}`;
  }

  _getRelativeTestPath(filepath) {
    if (!filepath) return 'unknown';
    return path.relative(process.cwd(), filepath);
  }

  _getTestSuiteName(test) {
    if (!test.file?.filepath) return 'unknown';
    const relativePath = this._getRelativeTestPath(test.file.filepath);
    return path.dirname(relativePath);
  }

  /**
   * Calculate statistics from TestModule objects (Vitest 4.x Reporter API)
   */
  _calculateStatsFromModules(testModules) {
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let skippedTests = 0;

    for (const testModule of testModules) {
      // Use TestModule.children.allTests() to get all tests
      for (const testCase of testModule.children.allTests()) {
        totalTests++;
        const result = testCase.result();
        if (result.state === 'passed') passedTests++;
        else if (result.state === 'failed') failedTests++;
        else if (result.state === 'skipped') skippedTests++;
      }
    }

    return { totalTests, passedTests, failedTests, skippedTests };
  }

  async _findReplayForTest(test) {
    console.log(`[TestDriver Reporter] ===== Finding replay URL for test: ${test.name} =====`);
    console.log(`[TestDriver Reporter] Test ID: ${test.id}`);
    
    // Check environment variable first
    if (process.env.DASHCAM_REPLAY_URL) {
      console.log(`[TestDriver Reporter] Using DASHCAM_REPLAY_URL from env: ${process.env.DASHCAM_REPLAY_URL}`);
      return process.env.DASHCAM_REPLAY_URL;
    }

    // Check global meta storage (set during teardown)
    if (globalThis.__testdriverMeta && globalThis.__testdriverMeta[test.name]) {
      const meta = globalThis.__testdriverMeta[test.name];
      console.log(`[TestDriver Reporter] ✓ Found test meta in global storage`);
      console.log(`[TestDriver Reporter]   Dashcam URL: ${meta.dashcamUrl}`);
      console.log(`[TestDriver Reporter]   Platform: ${meta.platform}`);
      
      // Also update detected platform
      if (meta.platform && !this.detectedPlatform) {
        this.detectedPlatform = meta.platform;
      }
      
      return meta.dashcamUrl;
    }

    // Try to get client from global registry
    let client = null;
    if (globalThis.__testdriverRegistry) {
      client = globalThis.__testdriverRegistry.getClient(test.id);
      if (client) {
        console.log(`[TestDriver Reporter] ✓ Found TestDriver client in global registry`);
        console.log(`[TestDriver Reporter]   Client OS: ${client.os}`);
        console.log(`[TestDriver Reporter]   Client session: ${client.getSessionId?.() || 'unknown'}`);
      } else {
        console.log(`[TestDriver Reporter] ✗ No client found in global registry for test ID: ${test.id}`);
        
        // List all registered test IDs for debugging
        const registeredIds = Array.from(globalThis.__testdriverRegistry.clients.keys());
        console.log(`[TestDriver Reporter]   Registered test IDs (${registeredIds.length}):`, registeredIds);
      }
    } else {
      console.log(`[TestDriver Reporter] ✗ Global __testdriverRegistry not available`);
    }

    // Check if testdriver client stored dashcamUrl
    if (client) {
      // Try to get dashcamUrl from client's last session
      if (client._lastDashcamUrl) {
        console.log(`[TestDriver Reporter] ✓ Using dashcamUrl from client: ${client._lastDashcamUrl}`);
        return client._lastDashcamUrl;
      }
      
      // Try dashcamUrl property
      if (client.dashcamUrl) {
        console.log(`[TestDriver Reporter] ✓ Using client.dashcamUrl: ${client.dashcamUrl}`);
        return client.dashcamUrl;
      }
      
      console.log(`[TestDriver Reporter] Client found but no dashcam URL properties set yet`);
    }

    // Fallback: Check legacy test.context (in case it's still available)
    if (test.context?.testdriver) {
      const contextClient = test.context.testdriver;
      console.log(`[TestDriver Reporter] Found testdriver client in test.context (legacy path)`);
      
      if (contextClient._lastDashcamUrl) {
        console.log(`[TestDriver Reporter] Using dashcamUrl from context client: ${contextClient._lastDashcamUrl}`);
        return contextClient._lastDashcamUrl;
      }
      
      if (contextClient.dashcamUrl) {
        console.log(`[TestDriver Reporter] Using context client.dashcamUrl: ${contextClient.dashcamUrl}`);
        return contextClient.dashcamUrl;
      }
    }

    // Parse test output for dashcam replay URLs
    // Match: https://app.dashcam.io/replay/691cf130c2fc02f59ae66fc1 or similar domains
    // Capture the full URL including query params
    const urlPattern = /(https?:\/\/(?:app\.)?(?:dashcam\.io|testdriver\.ai|replayable\.io)\/replay\/[a-f0-9]{24}(?:\?[^\s]*)?)/i;
    
    // Debug what's available in the test result
    const result = test.result();
    console.log(`[TestDriver Reporter] Test result properties:`, {
      state: result?.state,
      hasStdout: !!result?.stdout,
      hasStderr: !!result?.stderr,
      hasLogs: !!result?.logs,
      logsLength: result?.logs?.length || 0,
      hasErrors: !!result?.errors,
      errorsLength: result?.errors?.length || 0
    });
    
    // Check test console output (Vitest may or may not capture this)
    const allOutput = [
      result?.stdout,
      result?.stderr,
      ...(result?.logs || []),
    ].filter(Boolean).join('\n');
    
    console.log(`[TestDriver Reporter] Searching for replay URL in test output (${allOutput.length} chars)`);
    
    if (allOutput && allOutput.length > 0) {
      // Show a sample of what we're searching
      if (allOutput.length < 200) {
        console.log(`[TestDriver Reporter] Full output: ${allOutput}`);
      } else {
        console.log(`[TestDriver Reporter] Output sample (first 200 chars): ${allOutput.substring(0, 200)}...`);
      }
      
      const match = allOutput.match(urlPattern);
      if (match) {
        const replayUrl = match[1];
        console.log(`[TestDriver Reporter] ✓ Found replay URL in test output: ${replayUrl}`);
        
        // Validate the replay ID format
        const replayIdMatch = replayUrl.match(/\/replay\/([a-f0-9]{24})/i);
        if (replayIdMatch) {
          console.log(`[TestDriver Reporter] ✓ Validated replay ID: ${replayIdMatch[1]}`);
        } else {
          console.warn(`[TestDriver Reporter] ⚠ WARNING: Found URL but couldn't validate replay ID format: ${replayUrl}`);
        }
        
        return replayUrl;
      } else {
        console.log(`[TestDriver Reporter] ✗ No replay URL pattern match in output`);
      }
    } else {
      console.log(`[TestDriver Reporter] ✗ No test output available to search`);
    }
    
    // Also check test.meta for any stored URLs
    if (test.meta) {
      console.log(`[TestDriver Reporter] Checking test.meta:`, Object.keys(test.meta));
      if (test.meta.replayUrl) {
        console.log(`[TestDriver Reporter] Found replayUrl in test.meta: ${test.meta.replayUrl}`);
        return test.meta.replayUrl;
      }
      if (test.meta.dashcamUrl) {
        console.log(`[TestDriver Reporter] Found dashcamUrl in test.meta: ${test.meta.dashcamUrl}`);
        return test.meta.dashcamUrl;
      }
    }

    console.log(`[TestDriver Reporter] ===== No replay URL found for test: ${test.name} =====`);
    return null;
  }

  _detectCI() {
    if (process.env.GITHUB_ACTIONS) return 'github';
    if (process.env.GITLAB_CI) return 'gitlab';
    if (process.env.CIRCLECI) return 'circle';
    if (process.env.TRAVIS) return 'travis';
    if (process.env.JENKINS_URL) return 'jenkins';
    if (process.env.BUILDKITE) return 'buildkite';
    return null;
  }

  _getGitInfo() {
    const info = {};

    // Try to get from CI environment variables first
    if (process.env.GITHUB_ACTIONS) {
      if (process.env.GITHUB_REPOSITORY) info.repo = process.env.GITHUB_REPOSITORY;
      if (process.env.GITHUB_REF_NAME) info.branch = process.env.GITHUB_REF_NAME;
      if (process.env.GITHUB_SHA) info.commit = process.env.GITHUB_SHA;
      if (process.env.GITHUB_ACTOR) info.author = process.env.GITHUB_ACTOR;
    } else if (process.env.GITLAB_CI) {
      if (process.env.CI_PROJECT_PATH) info.repo = process.env.CI_PROJECT_PATH;
      if (process.env.CI_COMMIT_BRANCH) info.branch = process.env.CI_COMMIT_BRANCH;
      if (process.env.CI_COMMIT_SHA) info.commit = process.env.CI_COMMIT_SHA;
      if (process.env.GITLAB_USER_LOGIN) info.author = process.env.GITLAB_USER_LOGIN;
    } else if (process.env.CIRCLECI) {
      if (process.env.CIRCLE_PROJECT_USERNAME && process.env.CIRCLE_PROJECT_REPONAME) {
        info.repo = `${process.env.CIRCLE_PROJECT_USERNAME}/${process.env.CIRCLE_PROJECT_REPONAME}`;
      }
      if (process.env.CIRCLE_BRANCH) info.branch = process.env.CIRCLE_BRANCH;
      if (process.env.CIRCLE_SHA1) info.commit = process.env.CIRCLE_SHA1;
      if (process.env.CIRCLE_USERNAME) info.author = process.env.CIRCLE_USERNAME;
    }

    return info;
  }

  // API Methods - Direct HTTP calls to TestDriver API
  
  /**
   * Exchange API key for JWT token
   */
  async _authenticate() {
    const url = `${this.apiRoot}/auth/exchange-api-key`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        apiKey: this.apiKey
      })
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    this.token = data.token;
  }

  async _createTestRun(data) {
    const url = `${this.apiRoot}/api/v1/testdriver/test-run-create`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  async _recordTestCase(data) {
    const url = `${this.apiRoot}/api/v1/testdriver/test-case-create`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  async _completeTestRun(data) {
    const url = `${this.apiRoot}/api/v1/testdriver/test-run-complete`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }
}

module.exports = TestDriverReporter;
module.exports.default = TestDriverReporter;
