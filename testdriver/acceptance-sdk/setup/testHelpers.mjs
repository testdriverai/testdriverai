/**
 * Test Helpers and Utilities
 * Shared functions for SDK tests
 */

import TestDriver from '../../../sdk.js';

/**
 * Create a configured TestDriver client
 * @param {Object} options - Additional options
 * @returns {TestDriver} Configured client
 */
export function createTestClient(options = {}) {
  const client = new TestDriver(process.env.TD_API_KEY, {
    resolution: '1366x768',
    analytics: true,
    logging: process.env.VERBOSE === 'true' || process.env.LOGGING === 'true',
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
 */
export async function teardownTest(client, options = {}) {
  try {
    // Run postrun lifecycle if enabled
    if (options.postrun !== false) {
      await runPostrun(client);
    }
  } catch (error) {
    console.error('Error in postrun:', error);
  } finally {
    await client.disconnect();
  }
}

/**
 * Run prerun lifecycle hooks
 * Implements lifecycle/prerun.yaml functionality
 * @param {TestDriver} client - TestDriver client
 */
export async function runPrerun(client) {
  try {
    // Start dashcam tracking
    await client.exec('pwsh', 
      'dashcam track --name=TestDriver --type=application --pattern="C:\\Users\\testdriver\\Documents\\testdriver.log"',
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
 */
export async function runPostrun(client) {
  try {
    // Stop dashcam with title and push
    await client.exec('pwsh', 
      'dashcam -t \'Web Test Recording\' -p',
      10000, true);
  } catch (error) {
    console.warn('⚠️  Postrun hook failed (non-fatal):', error.message);
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
  
  // Enter username
  await client.hoverText('Username', 'username input field', 'click');
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
