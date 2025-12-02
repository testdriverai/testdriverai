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
 *   await testdriver.ready();
 *   await testdriver.provision.chrome({ url: 'https://example.com' });
 *   await testdriver.find('button').click();
 * });
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import TestDriverSDK from '../../sdk.js';

/**
 * Set up console log forwarding to the sandbox
 * This sets a global reference that the vitest plugin's onConsoleLog hook uses
 * @param {TestDriver} client - TestDriver client instance
 * @param {string} taskId - Unique task identifier for this test
 */
function setupConsoleForwarding(client, taskId) {
  // Set global sandbox reference for onConsoleLog hook in vitest plugin
  globalThis.__testdriverActiveSandbox = client.sandbox;
  
  console.log(`[testdriver] Console forwarding enabled for task: ${taskId}`);
}

/**
 * Remove console forwarding by clearing the global sandbox reference
 * @param {TestDriver} client - TestDriver client instance
 */
function clearConsoleForwarding(client) {
  // Only clear if this client's sandbox is the active one
  if (globalThis.__testdriverActiveSandbox === client.sandbox) {
    globalThis.__testdriverActiveSandbox = null;
    console.log(`[testdriver] Console forwarding disabled`);
  }
}

// Weak maps to store instances per test context
const testDriverInstances = new WeakMap();
const lifecycleHandlers = new WeakMap();

// Map to store shared instances by suite ID (for sharing across steps in a describe block)
const suiteInstances = new Map();

// Track all test IDs that use a shared suite instance (for writing dashcam URLs)
const suiteTestIds = new Map(); // suiteId -> Set of { testId, testName, testFile, startTime }

// Store file-level instances (for beforeAll/afterAll pattern)
const fileInstances = new Map(); // filePath -> testdriver instance

// Track test IDs for file-level instances
const fileTestIds = new Map(); // filePath -> Set of { testId, testFile }

// Track test run ID for this session (read from plugin's shared file)
let currentTestRunId = null;

/**
 * Get the test run ID from the plugin's shared file
 * Will retry a few times if file doesn't exist yet (timing issue with worker startup)
 * @returns {Promise<string|null>} The test run ID or null if not found
 */
async function getTestRunIdFromFile() {
  const testRunInfoFile = path.join(os.tmpdir(), 'testdriver-results', 'test-run-info.json');
  
  // Try up to 10 times with 100ms delay (1 second total)
  for (let i = 0; i < 10; i++) {
    try {
      if (fs.existsSync(testRunInfoFile)) {
        const info = JSON.parse(fs.readFileSync(testRunInfoFile, 'utf-8'));
        if (info.testRunId) {
          return info.testRunId;
        }
      }
    } catch (error) {
      // File may be being written, retry
    }
    
    // Wait 100ms before retry
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.warn('[testdriver] Test run info file not found after retries');
  return null;
}

/**
 * Record test case start to the API
 * @param {TestDriver} testdriver - TestDriver instance
 * @param {object} context - Vitest context
 * @param {number} startTime - Test start timestamp
 */
async function recordTestCaseStart(testdriver, context, startTime) {
  try {
    // Wait for connection if pending
    if (testdriver.__connectionPromise) {
      await testdriver.__connectionPromise;
    }
    
    // Get test run ID from plugin's shared file (not generated locally)
    if (!currentTestRunId) {
      currentTestRunId = await getTestRunIdFromFile();
    }
    
    // If still no test run ID, skip recording (plugin may not be configured)
    if (!currentTestRunId) {
      console.log(`[testdriver] Skipping test case recording - no test run ID found`);
      return;
    }
    
    const task = context.task;
    const parentSuite = getParentSuite(task);
    
    const testCaseData = {
      runId: currentTestRunId,
      testName: task.name,
      testFile: task.file?.filepath || task.file?.name || 'unknown',
      testOrder: task.id ? parseInt(task.id.split('-').pop()) || 0 : 0,
      suiteName: parentSuite?.name || 'Default Suite',
      status: 'running',
      startTime: startTime,
      sessionId: testdriver.getSessionId?.() || null
    };
    
    console.log(`[testdriver] Recording test case start: ${task.name}`);
    await testdriver.recordTestCase(testCaseData);
    console.log(`[testdriver] ✅ Test case started: ${task.name}`);
  } catch (error) {
    console.warn(`[testdriver] ⚠️ Failed to record test case start:`, error.message);
  }
}

/**
 * Record test case completion to the API
 * @param {TestDriver} testdriver - TestDriver instance
 * @param {object} context - Vitest context
 * @param {number} startTime - Test start timestamp
 * @param {string} status - Test result status ('passed' | 'failed')
 * @param {Error} [error] - Error if test failed
 */
async function recordTestCaseEnd(testdriver, context, startTime, status, error = null) {
  try {
    // Wait for connection if pending
    if (testdriver.__connectionPromise) {
      await testdriver.__connectionPromise;
    }
    
    // Get test run ID from plugin's shared file (not generated locally)
    if (!currentTestRunId) {
      currentTestRunId = await getTestRunIdFromFile();
    }
    
    // If still no test run ID, skip recording (plugin may not be configured)
    if (!currentTestRunId) {
      console.log(`[testdriver] Skipping test case recording - no test run ID found`);
      return;
    }
    
    const task = context.task;
    const parentSuite = getParentSuite(task);
    const endTime = Date.now();
    
    const testCaseData = {
      runId: currentTestRunId,
      testName: task.name,
      testFile: task.file?.filepath || task.file?.name || 'unknown',
      testOrder: task.id ? parseInt(task.id.split('-').pop()) || 0 : 0,
      suiteName: parentSuite?.name || 'Default Suite',
      status: status,
      startTime: startTime,
      endTime: endTime,
      duration: endTime - startTime,
      sessionId: testdriver.getSessionId?.() || null,
      ...(error && {
        errorMessage: error.message,
        errorStack: error.stack
      })
    };
    
    console.log(`[testdriver] Recording test case end: ${task.name} (${status})`);
    await testdriver.recordTestCase(testCaseData);
    console.log(`[testdriver] ✅ Test case recorded: ${task.name} - ${status}`);
  } catch (err) {
    console.warn(`[testdriver] ⚠️ Failed to record test case end:`, err.message);
  }
}

/**
 * Get the suite (describe block) that contains this test
 * @param {object} task - Vitest task object
 * @returns {object|null} Suite object or null
 */
function getParentSuite(task) {
  // Walk up the task tree to find the parent suite (describe block)
  let current = task;
  while (current) {
    if (current.type === 'suite' && current.id) {
      return current;
    }
    current = current.suite || current.parent;
  }
  return null;
}

/**
 * Get the file path from a Vitest context
 * @param {object} context - Vitest context object
 * @returns {string|null} File path or null
 */
function getFilePath(context) {
  if (!context) return null;
  
  // From beforeAll/afterAll context
  if (context.file?.filepath) return context.file.filepath;
  
  // From test context
  if (context.task?.file?.filepath) return context.task.file.filepath;
  if (context.task?.file?.name) return context.task.file.name;
  
  return null;
}

/**
 * Create a TestDriver instance for use in beforeAll/afterAll hooks
 * This is the recommended pattern for sharing an instance across all tests in a file.
 * 
 * @param {object} options - TestDriver options
 * @param {string} [options.apiKey] - TestDriver API key (defaults to process.env.TD_API_KEY)
 * @param {boolean} [options.headless] - Run sandbox in headless mode
 * @param {boolean} [options.newSandbox] - Create new sandbox
 * @returns {Promise<TestDriver>} TestDriver client instance (connected)
 * 
 * @example
 * import { createTestDriver, cleanupTestDriver } from 'testdriverai/vitest';
 * import { describe, it, beforeAll, afterAll } from 'vitest';
 * 
 * describe('My Tests', () => {
 *   let testdriver;
 * 
 *   beforeAll(async () => {
 *     testdriver = await createTestDriver({ headless: true });
 *     await testdriver.provision.chrome({ url: 'https://example.com' });
 *   });
 * 
 *   afterAll(async () => {
 *     await cleanupTestDriver(testdriver);
 *   });
 * 
 *   it('step01: click button', async () => {
 *     await testdriver.find('Button').click();
 *   });
 * 
 *   it('step02: type text', async () => {
 *     await testdriver.type('hello');
 *   });
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
  
  // Set up console forwarding to sandbox
  const taskId = `file-${Date.now()}`;
  setupConsoleForwarding(testdriver, taskId);
  
  // Create the log file on the remote machine
  const shell = testdriver.os === "windows" ? "pwsh" : "sh";
  const logPath = testdriver.os === "windows" 
    ? "C:\\Users\\testdriver\\Documents\\testdriver.log"
    : "/tmp/testdriver.log";
  
  const createLogCmd = testdriver.os === "windows"
    ? `New-Item -ItemType File -Path "${logPath}" -Force | Out-Null`
    : `touch ${logPath}`;
  
  await testdriver.exec(shell, createLogCmd, 10000, true);
  console.log('[testdriver] ✅ Created log file:', logPath);
  
  // Add log file tracking and start dashcam
  try {
    await testdriver.dashcam.addFileLog(logPath, "TestDriver Log");
    console.log('[testdriver] ✅ Added log file to dashcam tracking');
  } catch (error) {
    console.warn('[testdriver] ⚠️  Failed to add log tracking:', error.message);
  }
  
  await testdriver.dashcam.start();
  console.log('[testdriver] ✅ Dashcam started');
  
  // Mark this as a file-level instance
  testdriver.__isFileInstance = true;
  testdriver.__testIds = new Set();
  
  return testdriver;
}

/**
 * Register a test with a file-level TestDriver instance
 * Call this at the start of each test to track it for dashcam URL association
 * Also records the test case start to the API
 * 
 * @param {TestDriver} testdriver - The file-level TestDriver instance
 * @param {object} context - Vitest test context
 * 
 * @example
 * it('my test', async (context) => {
 *   registerTest(testdriver, context);
 *   await testdriver.find('Button').click();
 * });
 */
export function registerTest(testdriver, context) {
  if (!testdriver || !context?.task) return;
  
  const testId = context.task.id;
  const testName = context.task.name;
  const testFile = context.task.file?.filepath || context.task.file?.name || 'unknown';
  const startTime = Date.now();
  
  // Store start time on context for later use
  context.task.__testStartTime = startTime;
  
  if (testdriver.__testIds) {
    testdriver.__testIds.add({ testId, testName, testFile, startTime });
    console.log(`[testdriver] Registered test: ${testId}`);
  }
  
  // Record test case start to API
  recordTestCaseStart(testdriver, context, startTime);
  
  // Register test finished handler to record test case completion
  context.onTestFinished?.(async (result) => {
    const status = result?.state === 'fail' ? 'failed' : 'passed';
    const error = result?.errors?.[0] || null;
    await recordTestCaseEnd(testdriver, context, startTime, status, error);
  });
}

/**
 * Create a TestDriver client in a Vitest test with automatic lifecycle management
 * 
 * @param {object} context - Vitest test context (from async (context) => {})
 * @param {object} options - TestDriver options (passed directly to TestDriver constructor)
 * @param {string} [options.apiKey] - TestDriver API key (defaults to process.env.TD_API_KEY)
 * @param {boolean} [options.headless] - Run sandbox in headless mode
 * @param {boolean} [options.newSandbox] - Create new sandbox
 * @param {boolean} [options.autoConnect=true] - Automatically connect to sandbox
 * @returns {TestDriver} TestDriver client instance
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
    throw new Error('TestDriver() requires Vitest context. Pass the context parameter from your test function: test("name", async (context) => { ... })');
  }
  
  // Record test start time
  const testStartTime = Date.now();
  
  // Check if there's a shared instance for this suite (describe block)
  const parentSuite = getParentSuite(context.task);
  const suiteId = parentSuite?.id;
  
  if (suiteId && suiteInstances.has(suiteId)) {
    const existingInstance = suiteInstances.get(suiteId);
    // Store reference for this specific task too (for cleanup tracking)
    testDriverInstances.set(context.task, existingInstance);
    
    // Track this test ID for dashcam URL association later
    if (!suiteTestIds.has(suiteId)) {
      suiteTestIds.set(suiteId, new Set());
    }
    suiteTestIds.get(suiteId).add({
      testId: context.task.id,
      testName: context.task.name,
      testFile: context.task.file?.filepath || context.task.file?.name || 'unknown',
      startTime: testStartTime
    });
    console.log(`[testdriver] Registered test ${context.task.id} for shared suite ${suiteId}`);
    
    // Record test case start (async, don't await)
    recordTestCaseStart(existingInstance, context, testStartTime);
    
    return existingInstance;
  }
  
  // Return existing instance if already created for this specific test
  if (testDriverInstances.has(context.task)) {
    return testDriverInstances.get(context.task);
  }
  
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
  testdriver.__vitestContext = context.task;
  testdriver.__suiteId = suiteId; // Store for cleanup
  testDriverInstances.set(context.task, testdriver);
  
  // Also store in suite map so other tests in same describe block can share this instance
  if (suiteId) {
    suiteInstances.set(suiteId, testdriver);
    console.log(`[testdriver] Created shared instance for suite: ${suiteId}`);
    
    // Track this first test ID too
    if (!suiteTestIds.has(suiteId)) {
      suiteTestIds.set(suiteId, new Set());
    }
    suiteTestIds.get(suiteId).add({
      testId: context.task.id,
      testName: context.task.name,
      testFile: context.task.file?.filepath || context.task.file?.name || 'unknown',
      startTime: testStartTime
    });
    console.log(`[testdriver] Registered first test ${context.task.id} for shared suite ${suiteId}`);
  }
  
  // Store start time on context for later use
  context.task.__testStartTime = testStartTime;
  
  // Auto-connect if enabled (default: true)
  const autoConnect = config.autoConnect !== undefined ? config.autoConnect : true;
  if (autoConnect) {
    testdriver.__connectionPromise = (async () => {
      try {
        console.log('[testdriver] Connecting to sandbox...');
        await testdriver.auth();
        await testdriver.connect();
        console.log('[testdriver] ✅ Connected to sandbox');
        
        // Record test case start after connection
        recordTestCaseStart(testdriver, context, testStartTime);
        
        // Set up console forwarding to sandbox
        setupConsoleForwarding(testdriver, context.task.id);
        
        // Create the log file on the remote machine
        const shell = testdriver.os === "windows" ? "pwsh" : "sh";
        const logPath = testdriver.os === "windows" 
          ? "C:\\Users\\testdriver\\Documents\\testdriver.log"
          : "/tmp/testdriver.log";
        
        const createLogCmd = testdriver.os === "windows"
          ? `New-Item -ItemType File -Path "${logPath}" -Force | Out-Null`
          : `touch ${logPath}`;
        
        await testdriver.exec(shell, createLogCmd, 10000, true);
        console.log('[testdriver] ✅ Created log file:', logPath);
        
        // Add log file tracking and start dashcam
        try {
          await testdriver.dashcam.addFileLog(logPath, "TestDriver Log");
          console.log('[testdriver] ✅ Added log file to dashcam tracking');
        } catch (error) {
          console.warn('[testdriver] ⚠️  Failed to add log tracking:', error.message);
        }
        
        await testdriver.dashcam.start();
        console.log('[testdriver] ✅ Dashcam started');
      } catch (error) {
        console.error('[testdriver] Error during setup:', error);
        throw error;
      }
    })();
  }
  
  // For shared suite instances, don't register per-test cleanup
  // The instance will persist across all tests in the suite
  // Cleanup happens when the sandbox session times out or is explicitly stopped
  if (suiteId && suiteInstances.has(suiteId)) {
    // This is a shared instance - skip per-test cleanup but still record test case completion
    console.log(`[testdriver] Using shared instance for suite, skipping per-test cleanup`);
    
    // Register test finished handler for recording test case completion
    context.onTestFinished?.(async (result) => {
      const status = result?.state === 'fail' ? 'failed' : 'passed';
      const error = result?.errors?.[0] || null;
      await recordTestCaseEnd(testdriver, context, testStartTime, status, error);
    });
    
    return testdriver;
  }
  
  // Register cleanup handler with dashcam.stop() (only for non-shared instances)
  if (!lifecycleHandlers.has(context.task)) {
    const cleanup = async (result) => {
      // Record test case completion first
      const status = result?.state === 'fail' ? 'failed' : 'passed';
      const error = result?.errors?.[0] || null;
      await recordTestCaseEnd(testdriver, context, testStartTime, status, error);
      
      console.log('[testdriver] Cleaning up TestDriver client...');
      try {
        // Stop dashcam if it was started
        if (testdriver._dashcam && testdriver._dashcam.recording) {
          try {
            const dashcamUrl = await testdriver.dashcam.stop();
            console.log('🎥 Dashcam URL:', dashcamUrl);
            
            // Write dashcam URL to file for the reporter (cross-process communication)
            if (dashcamUrl) {
              const testId = context.task.id;
              const platform = testdriver.os || 'linux';
              const testFile = context.task.file?.filepath || context.task.file?.name || 'unknown';
              
              // Create results directory if it doesn't exist
              const resultsDir = path.join(os.tmpdir(), 'testdriver-results');
              if (!fs.existsSync(resultsDir)) {
                fs.mkdirSync(resultsDir, { recursive: true });
              }
              
              // Write test result file
              const testResultFile = path.join(resultsDir, `${testId}.json`);
              const testResult = {
                dashcamUrl,
                platform,
                testFile,
                testOrder: 0,
                sessionId: testdriver.getSessionId(),
              };
              
              fs.writeFileSync(testResultFile, JSON.stringify(testResult, null, 2));
              console.log(`[testdriver] ✅ Wrote dashcam URL to ${testResultFile}`);
              
              // Also register in memory if plugin is available
              if (globalThis.__testdriverPlugin?.registerDashcamUrl) {
                globalThis.__testdriverPlugin.registerDashcamUrl(testId, dashcamUrl, platform);
                console.log(`[testdriver] ✅ Registered dashcam URL in memory for test ${testId}`);
              }
            }
          } catch (error) {
            // Log more detailed error information for debugging
            console.error('❌ Failed to stop dashcam:', error.name || error.constructor?.name || 'Error');
            if (error.message) console.error('   Message:', error.message);
            // NotFoundError during cleanup is expected if sandbox already terminated
            if (error.name === 'NotFoundError' || error.responseData?.error === 'NotFoundError') {
              console.log('   ℹ️  Sandbox session already terminated - dashcam stop skipped');
            }
          }
        }
        
        // Clear console forwarding before disconnecting
        clearConsoleForwarding(testdriver);
        
        // Wait for connection to finish if it was initiated
        if (testdriver.__connectionPromise) {
          await testdriver.__connectionPromise.catch(() => {}); // Ignore connection errors during cleanup
        }
        await testdriver.disconnect();
        console.log('✅ Client disconnected');
      } catch (error) {
        console.error('Error disconnecting client:', error);
      }
    };
    lifecycleHandlers.set(context.task, cleanup);
    
    // Vitest will call this automatically after the test
    context.onTestFinished?.(cleanup);
  }
  
  return testdriver;
}

/**
 * Clean up a TestDriver instance and stop dashcam recording
 * Use this in afterAll() when using shared instances across tests
 * 
 * @param {TestDriver} testdriver - TestDriver instance to clean up
 * @returns {Promise<string|null>} Dashcam URL if recording was active
 * 
 * @example
 * import { TestDriver, cleanupTestDriver } from 'testdriverai/vitest';
 * 
 * describe('My Suite', () => {
 *   afterAll(async () => {
 *     // Get any instance from the suite and clean it up
 *     // This stops dashcam and disconnects
 *   });
 *   
 *   it('step01', async (context) => {
 *     const testdriver = TestDriver(context);
 *     await testdriver.provision.chrome({ url: 'https://example.com' });
 *   });
 * });
 */
export async function cleanupTestDriver(testdriver) {
  if (!testdriver) {
    console.warn('[testdriver] cleanupTestDriver called with no instance');
    return null;
  }
  
  let dashcamUrl = null;
  const suiteId = testdriver.__suiteId;
  const isFileInstance = testdriver.__isFileInstance;
  
  console.log('[testdriver] Cleaning up TestDriver instance...');
  
  try {
    // Stop dashcam if it was started
    if (testdriver._dashcam && testdriver._dashcam.recording) {
      try {
        dashcamUrl = await testdriver.dashcam.stop();
        console.log('🎥 Dashcam URL:', dashcamUrl);
        
        // Determine which test IDs to write dashcam URLs for
        let testsToWrite = null;
        
        if (isFileInstance && testdriver.__testIds?.size > 0) {
          // File-level instance (from createTestDriver + registerTest)
          testsToWrite = testdriver.__testIds;
        } else if (suiteId && suiteTestIds.has(suiteId)) {
          // Suite-level instance (from TestDriver(context) pattern)
          testsToWrite = suiteTestIds.get(suiteId);
        }
        
        // Write dashcam URL to result files for ALL tests that used this instance
        if (dashcamUrl && testsToWrite && testsToWrite.size > 0) {
          const platform = testdriver.os || 'linux';
          const sessionId = testdriver.getSessionId?.() || null;
          
          // Create results directory if it doesn't exist
          const resultsDir = path.join(os.tmpdir(), 'testdriver-results');
          if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
          }
          
          console.log(`[testdriver] Writing dashcam URL to ${testsToWrite.size} test result files...`);
          
          let testOrder = 0;
          for (const testInfo of testsToWrite) {
            const testResultFile = path.join(resultsDir, `${testInfo.testId}.json`);
            const testResult = {
              dashcamUrl,
              platform,
              testFile: testInfo.testFile,
              testOrder: testOrder++,
              sessionId,
            };
            
            fs.writeFileSync(testResultFile, JSON.stringify(testResult, null, 2));
            console.log(`[testdriver] ✅ Wrote dashcam URL for test: ${testInfo.testId}`);
            
            // Also register in memory if plugin is available
            if (globalThis.__testdriverPlugin?.registerDashcamUrl) {
              globalThis.__testdriverPlugin.registerDashcamUrl(testInfo.testId, dashcamUrl, platform);
            }
          }
          
          // Clear the tracked tests
          if (suiteId) {
            suiteTestIds.delete(suiteId);
          }
        }
      } catch (error) {
        console.error('❌ Failed to stop dashcam:', error.message);
        if (error.name === 'NotFoundError' || error.responseData?.error === 'NotFoundError') {
          console.log('   ℹ️  Sandbox session already terminated - dashcam stop skipped');
        }
      }
    }
    
    // Clear console forwarding
    clearConsoleForwarding(testdriver);
    
    // Wait for connection promise if pending
    if (testdriver.__connectionPromise) {
      await testdriver.__connectionPromise.catch(() => {});
    }
    
    // Disconnect from sandbox
    await testdriver.disconnect();
    console.log('✅ TestDriver instance cleaned up');
    
    // Clear from suite instances map
    if (suiteId && suiteInstances.has(suiteId)) {
      suiteInstances.delete(suiteId);
      console.log(`[testdriver] Removed shared instance for suite: ${suiteId}`);
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
  
  return dashcamUrl;
}
