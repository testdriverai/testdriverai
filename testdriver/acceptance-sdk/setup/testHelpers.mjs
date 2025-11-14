/**
 * Test Helpers and Utilities
 * Shared functions for SDK tests
 */

import fs from 'fs';
import path from 'path';
import TestDriver from '../../../sdk.js';

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
export function storeTestResult(testName, testFile, dashcamUrl, sessionInfo = {}) {
  console.log(`📝 Storing test result: ${testName}`);
  console.log(`   Dashcam URL: ${dashcamUrl || 'none'}`);
  
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
export function saveTestResults(outputPath = 'test-results/sdk-summary.json') {
  const results = getTestResults();
  const dir = path.dirname(outputPath);
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n📊 Test results saved to: ${outputPath}`);
  
  // Also print dashcam URLs to console
  console.log('\n🎥 Dashcam URLs:');
  results.tests.forEach(test => {
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
  const os = process.env.TD_OS || 'windows';
  
  const client = new TestDriver(process.env.TD_API_KEY, {
    resolution: '1366x768',
    analytics: true,
    os: os, // Use OS from environment variable (windows or linux)
    // apiRoot: 'https://replayable-dev-ian-mac-m1-16.ngrok.io',
    logging: process.env.LOGGING === 'false' ? false : true, // Enabled by default, disable with LOGGING=false
    ...options
  });

  // Enable detailed event logging if requested
  if (process.env.DEBUG_EVENTS === 'true') {
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
  emitter.on('**', function(data) {
    const event = this.event;
    if (event.startsWith('log:debug')) return; // Skip debug logs
    console.log(`[EVENT] ${event}`, data || '');
  });

  // Log command lifecycle
  emitter.on('command:start', (data) => {
    console.log('🚀 Command started:', data);
  });

  emitter.on('command:success', (data) => {
    console.log('✅ Command succeeded:', data);
  });

  emitter.on('command:error', (data) => {
    console.error('❌ Command error:', data);
  });

  // Log sandbox events
  emitter.on('sandbox:connected', () => {
    console.log('🔌 Sandbox connected');
  });

  emitter.on('sandbox:authenticated', () => {
    console.log('🔐 Sandbox authenticated');
  });

  emitter.on('sandbox:error', (error) => {
    console.error('⚠️  Sandbox error:', error);
  });

  // Log SDK API calls
  emitter.on('sdk:request', (data) => {
    console.log('📤 SDK Request:', data);
  });

  emitter.on('sdk:response', (data) => {
    console.log('📥 SDK Response:', data);
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
    newSandbox: true,
    ...options 
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
  
  console.log('🧹 Running teardown...');
  
  try {
    // Run postrun lifecycle if enabled
    if (options.postrun !== false) {
      dashcamUrl = await runPostrun(client);
    } else {
      console.log('⏭️  Postrun skipped (disabled in options)');
    }
  } catch (error) {
    console.error('❌ Error in postrun:', error);
  } finally {
    await client.disconnect();
  }
  
  const sessionInfo = {
    sessionId: client.getSessionId(),
    dashcamUrl: dashcamUrl,
    instance: client.getInstance(),
  };
  
  console.log('📊 Session info:', JSON.stringify(sessionInfo, null, 2));
  
  return sessionInfo;
}

/**
 * Run prerun lifecycle hooks
 * Implements lifecycle/prerun.yaml functionality
 * @param {TestDriver} client - TestDriver client
 */
export async function runPrerun(client) {
  try {

    await client.exec('pwsh', 'npm install dashcam@beta -g', 10000, true);

    // Start dashcam tracking
    await client.exec('pwsh', 
      'dashcam track --name=TestDriver --type=app --pattern="C:\\Users\\testdriver\\Documents\\testdriver.log"',
      10000, true);
    
    // Start dashcam recording
    await client.exec('pwsh', 'dashcam start', 10000, true);
    
    // Launch Chrome with guest mode
    await client.exec('pwsh', `
      Start-Process "C:/Program Files/Google/Chrome/Application/chrome.exe" -ArgumentList "--start-maximized", "--guest", "https://testdriver-sandbox.vercel.app/login"
    `, 10000, true);
    
    // Wait for the login page to load
    await client.waitForText('TestDriver.ai Sandbox', 60000);
    
  } catch (error) {
    console.warn('⚠️  Prerun hook failed (non-fatal):', error.message);
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
    console.log('🎬 Stopping dashcam and retrieving URL...');
    
    // Stop dashcam with title and push - this returns the URL
    const output = await client.exec('pwsh', 
      'dashcam -t \'Web Test Recording\' -p',
      10000, false); // Don't silence output so we can capture it
    
    console.log('📤 Dashcam command output:', output);
    
    // Extract URL from output - dashcam typically outputs the URL in the response
    // The URL is usually in the format: https://dashcam.testdriver.ai/...
    if (output) {
      const urlMatch = output.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        const url = urlMatch[0];
        console.log('✅ Found dashcam URL:', url);
        return url;
      } else {
        console.warn('⚠️  No URL found in dashcam output');
      }
    } else {
      console.warn('⚠️  Dashcam command returned no output');
    }
    
    return null;
  } catch (error) {
    console.warn('⚠️  Postrun hook failed (non-fatal):', error.message);
    return null;
  }
}

/**
 * Perform login flow (reusable snippet)
 * @param {TestDriver} client - TestDriver client
 * @param {string} username - Username (default: 'standard_user')
 * @param {string} password - Password (default: retrieved from screen)
 */
export async function performLogin(client, username = 'standard_user', password = null) {
  await client.focusApplication('Google Chrome');
  
  // Get password from screen if not provided
  if (!password) {
    password = await client.remember('the password');
  }
  
  await client.hoverText('Username', 'label above the username input field on the login form', 'click');
  await client.type(username);
  
  // Enter password
  await client.pressKeys(['tab']);
  await client.type(password);
  
  // Submit form
  await client.pressKeys(['tab']);
  await client.pressKeys(['enter']);
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
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Conditional execution helper
 * Simulates if-else logic by trying an assertion
 * @param {TestDriver} client - TestDriver client
 * @param {string} condition - Condition to check
 * @param {Function} thenFn - Function to run if condition is true
 * @param {Function} elseFn - Function to run if condition is false
 */
export async function conditionalExec(client, condition, thenFn, elseFn = null) {
  try {
    await client.assert(condition);
    if (thenFn) {
      await thenFn();
    }
  } catch {
    if (elseFn) {
      await elseFn();
    }
  }
}

/**
 * Create a test step tracker for better debugging
 * Provides visibility into which step failed, similar to YAML runner
 * 
 * @example
 * const tracker = createStepTracker('Login Test');
 * 
 * await tracker.step('Navigate to login', async () => {
 *   await client.assert('login page is visible');
 * });
 * 
 * await tracker.step('Enter credentials', async () => {
 *   await client.hoverText('Username');
 *   await client.type('user@example.com');
 * });
 */
export function createStepTracker(testName) {
  let currentStep = 0;
  const steps = [];

  return {
    /**
     * Execute a test step with tracking
     * @param {string} description - Step description
     * @param {Function} fn - Step function to execute
     */
    async step(description, fn) {
      currentStep++;
      const stepNumber = currentStep;
      
      console.log(`\n📍 Step ${stepNumber}: ${description}`);
      
      const startTime = Date.now();
      
      try {
        const result = await fn();
        const duration = Date.now() - startTime;
        
        steps.push({
          step: stepNumber,
          description,
          status: 'passed',
          duration,
        });
        
        console.log(`   ✅ Passed (${duration}ms)`);
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        steps.push({
          step: stepNumber,
          description,
          status: 'failed',
          duration,
          error: error.message,
        });
        
        console.error(`   ❌ Failed at step ${stepNumber}: ${description}`);
        console.error(`   Error: ${error.message}`);
        console.error(`\n📊 Test Progress (${testName}):`);
        steps.forEach(s => {
          const icon = s.status === 'passed' ? '✅' : '❌';
          console.error(`   ${icon} Step ${s.step}: ${s.description} (${s.duration}ms)`);
        });
        
        throw error;
      }
    },
    
    /**
     * Get execution summary
     */
    getSummary() {
      return {
        testName,
        totalSteps: steps.length,
        passed: steps.filter(s => s.status === 'passed').length,
        failed: steps.filter(s => s.status === 'failed').length,
        steps: [...steps],
      };
    }
  };
}
