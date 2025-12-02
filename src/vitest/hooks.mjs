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
 * Intercept console logs and write to a log file on the remote machine
 * This allows test logs to appear in Dashcam recordings
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

  // Determine log file path based on OS
  const logPath = client.os === "windows" 
    ? "C:\\Users\\testdriver\\Documents\\testdriver.log"
    : "/tmp/testdriver.log";

  // Store log path on client for later use
  client._testLogPath = logPath;

  // Track if we're currently writing to avoid infinite loops
  let isWriting = false;

  // Create wrapper that writes to log file
  const createInterceptor = (level, originalMethod) => {
    return function (...args) {
      // Call original console method first
      originalMethod.apply(console, args);

      // Skip if already writing to avoid infinite loops
      if (isWriting) return;

      // Format the log message
      const message = args
        .map((arg) =>
          typeof arg === "object"
            ? JSON.stringify(arg, null, 2)
            : String(arg),
        )
        .join(" ");

      // Also send to sandbox for immediate visibility
      if (client.sandbox && client.sandbox.instanceSocketConnected) {
  
          client.sandbox.send({
            type: "output",
            output: Buffer.from(message, "utf8").toString("base64"),
          });
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
    `[useTestDriver] Console interceptor enabled for task: ${taskId}`,
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
      `[useTestDriver] Console interceptor removed for task: ${taskId}`,
    );

    // Clean up reference
    delete client._consoleInterceptor;
  }
}

// Weak maps to store instances per test context
const testDriverInstances = new WeakMap();
const lifecycleHandlers = new WeakMap();

// Map to store shared instances by suite ID (for sharing across steps in a describe block)
const suiteInstances = new Map();

// Track all test IDs that use a shared suite instance (for writing dashcam URLs)
const suiteTestIds = new Map(); // suiteId -> Set of { testId, testFile }

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
      testFile: context.task.file?.filepath || context.task.file?.name || 'unknown'
    });
    console.log(`[testdriver] Registered test ${context.task.id} for shared suite ${suiteId}`);
    
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
      testFile: context.task.file?.filepath || context.task.file?.name || 'unknown'
    });
    console.log(`[testdriver] Registered first test ${context.task.id} for shared suite ${suiteId}`);
  }
  
  // Auto-connect if enabled (default: true)
  const autoConnect = config.autoConnect !== undefined ? config.autoConnect : true;
  if (autoConnect) {
    testdriver.__connectionPromise = (async () => {
      try {
        console.log('[testdriver] Connecting to sandbox...');
        await testdriver.auth();
        await testdriver.connect();
        console.log('[testdriver] ✅ Connected to sandbox');
        
        // Set up console interceptor after connection
        setupConsoleInterceptor(testdriver, context.task.id);
        
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
        
        // Add automatic log tracking when dashcam starts
        // Store original start method
        const originalDashcamStart = testdriver.dashcam.start.bind(testdriver.dashcam);
        testdriver.dashcam.start = async function() {
          // Call original start (which handles auth)
          await originalDashcamStart();
          
          // Add log file tracking after dashcam starts
          try {
            await testdriver.dashcam.addFileLog(logPath, "TestDriver Log");
            console.log('[testdriver] ✅ Added log file to dashcam tracking');
          } catch (error) {
            console.warn('[testdriver] ⚠️  Failed to add log tracking:', error.message);
          }
        };
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
    // This is a shared instance - skip per-test cleanup
    console.log(`[testdriver] Using shared instance for suite, skipping per-test cleanup`);
    return testdriver;
  }
  
  // Register cleanup handler with dashcam.stop() (only for non-shared instances)
  if (!lifecycleHandlers.has(context.task)) {
    const cleanup = async () => {
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
        
        // Remove console interceptor before disconnecting
        removeConsoleInterceptor(testdriver);
        
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
  
  console.log('[testdriver] Cleaning up TestDriver instance...');
  
  try {
    // Stop dashcam if it was started
    if (testdriver._dashcam && testdriver._dashcam.recording) {
      try {
        dashcamUrl = await testdriver.dashcam.stop();
        console.log('🎥 Dashcam URL:', dashcamUrl);
        
        // Write dashcam URL to result files for ALL tests that used this shared instance
        if (dashcamUrl && suiteId && suiteTestIds.has(suiteId)) {
          const platform = testdriver.os || 'linux';
          const sessionId = testdriver.getSessionId?.() || null;
          const testsInSuite = suiteTestIds.get(suiteId);
          
          // Create results directory if it doesn't exist
          const resultsDir = path.join(os.tmpdir(), 'testdriver-results');
          if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
          }
          
          console.log(`[testdriver] Writing dashcam URL to ${testsInSuite.size} test result files...`);
          
          let testOrder = 0;
          for (const testInfo of testsInSuite) {
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
          
          // Clear the tracked tests for this suite
          suiteTestIds.delete(suiteId);
        }
      } catch (error) {
        console.error('❌ Failed to stop dashcam:', error.message);
        if (error.name === 'NotFoundError' || error.responseData?.error === 'NotFoundError') {
          console.log('   ℹ️  Sandbox session already terminated - dashcam stop skipped');
        }
      }
    }
    
    // Remove console interceptor
    if (testdriver._consoleInterceptor) {
      removeConsoleInterceptor(testdriver);
    }
    
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
