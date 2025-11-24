/**
 * Vitest Hooks for TestDriver
 * 
 * Provides React-style hooks for using TestDriver and Dashcam in Vitest tests.
 * Hooks automatically manage lifecycle (setup/teardown) and integrate with the plugin.
 * 
 * @example
 * import { useTestDriver, useDashcam } from 'testdriverai/vitest/hooks';
 * 
 * test('my test', async (context) => {
 *   const client = useTestDriver(context);
 *   const dashcam = useDashcam(context, client);
 *   
 *   await dashcam.start();
 *   await client.find('button').click();
 *   const url = await dashcam.stop();
 * });
 */

import TestDriver from '../../sdk.js';
import { Dashcam } from '../../src/core/index.js';

// Weak maps to store instances per test context
const testDriverInstances = new WeakMap();
const dashcamInstances = new WeakMap();
const lifecycleHandlers = new WeakMap();

/**
 * Use TestDriver client in a test
 * Creates and manages TestDriver instance for the current test
 * 
 * @param {object} context - Vitest test context (from async (context) => {})
 * @param {object} options - TestDriver options
 * @param {string} options.apiKey - TestDriver API key (defaults to process.env.TD_API_KEY)
 * @param {string} options.apiRoot - API endpoint (defaults to process.env.TD_API_ROOT)
 * @param {string} options.os - Target OS: 'linux', 'mac', 'windows' (defaults to process.env.TD_OS || 'linux')
 * @param {boolean} options.new - Create new sandbox (default: true)
 * @param {object} options.cacheThresholds - Cache thresholds for find operations
 * @returns {TestDriver} TestDriver client instance
 * 
 * @example
 * test('my test', async (context) => {
 *   const client = useTestDriver(context, { os: 'linux' });
 *   await client.find('Login button').click();
 * });
 */
export function useTestDriver(context, options = {}) {
  if (!context || !context.task) {
    throw new Error('useTestDriver requires Vitest context. Pass the context parameter from your test function: test("name", async (context) => { ... })');
  }
  
  // Return existing instance if already created for this test
  if (testDriverInstances.has(context.task)) {
    return testDriverInstances.get(context.task);
  }
  
  // Create new TestDriver instance
  const config = {
    apiKey: options.apiKey || process.env.TD_API_KEY,
    apiRoot: options.apiRoot || process.env.TD_API_ROOT || 'https://testdriver-api.onrender.com',
    os: options.os || process.env.TD_OS || 'linux',
    new: options.new !== undefined ? options.new : true,
    cacheThresholds: options.cacheThresholds || { find: 0.05, findAll: 0.05 },
  };
  
  const client = new TestDriver(config);
  client.__vitestContext = context.task; // Store reference for cleanup
  testDriverInstances.set(context.task, client);
  
  // Register cleanup handler
  if (!lifecycleHandlers.has(context.task)) {
    const cleanup = async () => {
      console.log('[useTestDriver] Cleaning up TestDriver client...');
      try {
        await client.disconnect();
        console.log('✅ Client disconnected');
      } catch (error) {
        console.error('Error disconnecting client:', error);
      }
    };
    lifecycleHandlers.set(context.task, cleanup);
    
    // Vitest will call this automatically after the test
    context.onTestFinished?.(cleanup);
  }
  
  return client;
}

/**
 * Use Dashcam in a test
 * Creates and manages Dashcam instance for the current test
 * 
 * @param {object} context - Vitest test context
 * @param {TestDriver} client - TestDriver client instance (from useTestDriver)
 * @param {object} options - Dashcam options
 * @param {string} options.apiKey - Dashcam API key (defaults to process.env.DASHCAM_API_KEY)
 * @param {boolean} options.autoAuth - Automatically authenticate (default: true)
 * @param {boolean} options.autoStart - Automatically start recording (default: false)
 * @param {boolean} options.autoStop - Automatically stop recording at test end (default: false)
 * @returns {Dashcam} Dashcam instance
 * 
 * @example
 * test('my test', async (context) => {
 *   const client = useTestDriver(context);
 *   const dashcam = useDashcam(context, client, { autoStart: true, autoStop: true });
 *   
 *   // Dashcam automatically started
 *   await client.find('button').click();
 *   // Dashcam automatically stopped and URL registered
 * });
 */
export function useDashcam(context, client, options = {}) {
  if (!context || !context.task) {
    throw new Error('useDashcam requires Vitest context. Pass the context parameter from your test function.');
  }
  
  if (!client) {
    throw new Error('useDashcam requires a TestDriver client. Call useTestDriver first.');
  }
  
  // Return existing instance if already created for this test
  if (dashcamInstances.has(context.task)) {
    return dashcamInstances.get(context.task);
  }
  
  // Create new Dashcam instance
  const config = {
    apiKey: options.apiKey || process.env.DASHCAM_API_KEY || '4e93d8bf-3886-4d26-a144-116c4063522d',
  };
  
  const dashcam = new Dashcam(client, config);
  dashcamInstances.set(context.task, dashcam);
  
  // Auto-auth if configured (default: true)
  const shouldAutoAuth = options.autoAuth !== false;
  if (shouldAutoAuth) {
    // Queue auth for immediate execution
    (async () => {
      try {
        await dashcam.auth();
        console.log('[useDashcam] ✅ Authenticated with Dashcam');
      } catch (error) {
        console.error('[useDashcam] Error authenticating:', error);
      }
    })();
  }
  
  // Auto-start if configured
  if (options.autoStart) {
    (async () => {
      try {
        if (shouldAutoAuth) {
          // Wait a moment for auth to complete
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        await dashcam.start();
        console.log('[useDashcam] ✅ Recording started');
      } catch (error) {
        console.error('[useDashcam] Error starting recording:', error);
      }
    })();
  }
  
  // Auto-stop if configured
  if (options.autoStop) {
    const cleanup = async () => {
      console.log('[useDashcam] Stopping Dashcam...');
      try {
        const url = await dashcam.stop();
        if (url) {
          console.log('🎥 Dashcam URL:', url);
          
          // Register URL with plugin if available
          if (globalThis.__testdriverPlugin?.registerDashcamUrl) {
            const testId = `${context.task.file?.id || 'unknown'}_${context.task.id}_0`;
            globalThis.__testdriverPlugin.registerDashcamUrl(testId, url, client.os);
          }
        }
      } catch (error) {
        console.error('[useDashcam] Error stopping Dashcam:', error);
      }
    };
    
    context.onTestFinished?.(cleanup);
  }
  
  return dashcam;
}

/**
 * Use both TestDriver and Dashcam together with auto-lifecycle
 * This is the simplest way to get started - everything is automatic!
 * 
 * @param {object} context - Vitest test context
 * @param {object} options - Combined options
 * @param {string} options.os - Target OS (default: 'linux')
 * @param {boolean} options.new - Create new sandbox (default: true)
 * @returns {{ client: TestDriver, dashcam: Dashcam }} Both instances
 * 
 * @example
 * test('my test', async (context) => {
 *   const { client, dashcam } = useTestDriverWithDashcam(context);
 *   
 *   // Everything auto-managed: connection, recording, cleanup
 *   await client.find('Login button').click();
 * });
 */
export function useTestDriverWithDashcam(context, options = {}) {
  const client = useTestDriver(context, options);
  const dashcam = useDashcam(context, client, {
    autoAuth: true,
    autoStart: true,
    autoStop: true,
    ...options,
  });
  
  return { client, dashcam };
}

