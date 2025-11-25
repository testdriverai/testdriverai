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

import fs from 'fs';
import os from 'os';
import path from 'path';
import TestDriver from '../../sdk.js';
import { Dashcam } from '../../src/core/index.js';

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

      // Write to log file on remote machine (async, don't await)
      const timestamp = new Date().toISOString();
      const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
      
      // Escape for shell (simple escaping - replace single quotes)
      const escapedLog = logLine.replace(/'/g, "'\\''");
      
      const shell = client.os === "windows" ? "pwsh" : "sh";
      const writeCommand = client.os === "windows"
        ? `Add-Content -Path "${logPath}" -Value '${escapedLog}'`
        : `echo '${escapedLog}' >> ${logPath}`;

      // Set flag to prevent recursion
      isWriting = true;
      
      // Write asynchronously (fire and forget)
      client.exec(shell, writeCommand, 5000, false).catch(() => {
        // Silently fail to avoid breaking the test
      }).finally(() => {
        isWriting = false;
      });

      // Also send to sandbox for immediate visibility
      if (client.sandbox && client.sandbox.instanceSocketConnected) {
        try {
          client.sandbox.send({
            type: "output",
            output: Buffer.from(message, "utf8").toString("base64"),
          });
        } catch (error) {
          // Silently fail
        }
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
 * @param {boolean} options.autoConnect - Automatically connect to sandbox (default: true)
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
  const apiKey = options.apiKey || process.env.TD_API_KEY;
  const config = {
    apiRoot: options.apiRoot || process.env.TD_API_ROOT || 'https://testdriver-api.onrender.com',
    os: options.os || process.env.TD_OS || 'linux',
    newSandbox: options.new !== undefined ? options.new : true,
    cacheThresholds: options.cacheThresholds || { find: 0.05, findAll: 0.05 },
    resolution: options.resolution || '1366x768',
    analytics: options.analytics !== undefined ? options.analytics : true,
  };
  
  const client = new TestDriver(apiKey, config);
  client.__vitestContext = context.task; // Store reference for cleanup
  testDriverInstances.set(context.task, client);
  
  // Auto-connect if enabled (default: true)
  const autoConnect = options.autoConnect !== undefined ? options.autoConnect : true;
  if (autoConnect) {
    // Create a promise that will connect the client
    // This runs asynchronously but we store the promise so presets can await it
    client.__connectionPromise = (async () => {
      try {
        console.log('[useTestDriver] Connecting to sandbox...');
        await client.auth();
        await client.connect({ new: config.newSandbox });
        console.log('[useTestDriver] ✅ Connected to sandbox');
        
        // Set up console interceptor after connection
        setupConsoleInterceptor(client, context.task.id);
        
        // Create the log file on the remote machine
        const shell = client.os === "windows" ? "pwsh" : "sh";
        const logPath = client.os === "windows" 
          ? "C:\\Users\\testdriver\\Documents\\testdriver.log"
          : "/tmp/testdriver.log";
        
        const createLogCmd = client.os === "windows"
          ? `New-Item -ItemType File -Path "${logPath}" -Force | Out-Null`
          : `touch ${logPath}`;
        
        await client.exec(shell, createLogCmd, 10000, true);
        console.log('[useTestDriver] ✅ Created log file:', logPath);
      } catch (error) {
        console.error('[useTestDriver] Error connecting to sandbox:', error);
        throw error;
      }
    })();
  }
  
  // Register cleanup handler
  if (!lifecycleHandlers.has(context.task)) {
    const cleanup = async () => {
      console.log('[useTestDriver] Cleaning up TestDriver client...');
      try {
        // Remove console interceptor before disconnecting
        removeConsoleInterceptor(client);
        
        // Wait for connection to finish if it was initiated
        if (client.__connectionPromise) {
          await client.__connectionPromise.catch(() => {}); // Ignore connection errors during cleanup
        }
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
  // Dashcam uses the same API key as TestDriver
  const apiKey = options.apiKey || process.env.TD_API_KEY;
  
  // Skip Dashcam if no API key provided
  if (!apiKey) {
    console.log('[useDashcam] ⚠️  No API key provided, skipping Dashcam');
    // Return a null-like object that won't break tests
    const noop = { auth: async () => {}, start: async () => {}, stop: async () => null, isRecording: () => false };
    dashcamInstances.set(context.task, noop);
    return noop;
  }
  
  const config = { apiKey };
  
  const dashcam = new Dashcam(client, config);
  dashcamInstances.set(context.task, dashcam);
  
  // Auto-auth if configured (default: true)
  const shouldAutoAuth = options.autoAuth !== false;
  if (shouldAutoAuth) {
    // Store auth promise so presets can await it
    dashcam.__authPromise = (async () => {
      try {
        await dashcam.auth();
        console.log('[useDashcam] ✅ Authenticated with Dashcam');
      } catch (error) {
        console.warn('[useDashcam] ⚠️  Dashcam authentication failed:', error.message);
        console.warn('[useDashcam] Tests will continue without Dashcam recording');
        // Don't throw - allow tests to continue without Dashcam
      }
    })();
  }
  
  // Auto-start if configured
  if (options.autoStart) {
    dashcam.__startPromise = (async () => {
      try {
        // Wait for auth to complete first
        if (dashcam.__authPromise) {
          await dashcam.__authPromise;
        }
        
        // Wait for client connection if needed
        if (client.__connectionPromise) {
          await client.__connectionPromise;
        }
        
        // Add log file tracking if console interceptor is set up
        if (client._testLogPath) {
          console.log('[useDashcam] Adding log file to tracking:', client._testLogPath);
          await dashcam.addFileLog(client._testLogPath, "Test Console Logs");
        }
        
        await dashcam.start();
        console.log('[useDashcam] ✅ Recording started');
      } catch (error) {
        console.warn('[useDashcam] ⚠️  Could not start recording:', error.message);
        console.warn('[useDashcam] Tests will continue without Dashcam recording');
        // Don't throw - allow tests to continue
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
          
          // Write test result file for the reporter to pick up
          const testResultFile = path.join(
            os.tmpdir(),
            'testdriver-results',
            `${context.task.id}.json`
          );
          
          try {
            // Ensure directory exists
            const dir = path.dirname(testResultFile);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            
            // Get test file path from Vitest context
            // Try multiple ways to get the file path
            // Resolve testFile with fallback options
            const testFile = context.task.file?.filepath 
              || context.task.file?.name 
              || context.task.suite?.file?.filepath 
              || context.task.suite?.file?.name 
              || 'unknown';
            
            // Calculate test order (index within parent suite)
            let testOrder = 0;
            if (context.task.suite && context.task.suite.tasks) {
              testOrder = context.task.suite.tasks.indexOf(context.task);
            }
            
            // Extract replay object ID from URL
            const replayObjectId = url.match(/\/replay\/([^?]+)/)?.[1] || null;
            
            // Write test result
            const testResult = {
              testId: context.task.id,
              testName: context.task.name,
              testFile: testFile,
              testOrder: testOrder,
              dashcamUrl: url,
              replayObjectId: replayObjectId,
              platform: client.os,
              timestamp: Date.now(),
            };
            
            fs.writeFileSync(testResultFile, JSON.stringify(testResult, null, 2));
            console.log(`[useDashcam] ✅ Wrote test result to ${testResultFile}`);
          } catch (error) {
            console.error('[useDashcam] ❌ Failed to write test result file:', error.message);
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

