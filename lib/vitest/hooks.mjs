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

import chalk from 'chalk';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { vi } from 'vitest';
import TestDriverSDK from '../../sdk.js';

/**
 * Set up console spies using Vitest's vi.spyOn to intercept console logs
 * and forward them to the sandbox for Dashcam visibility.
 * This is test-isolated and doesn't cause conflicts with concurrent tests.
 * @param {TestDriver} client - TestDriver client instance
 * @param {string} taskId - Unique task identifier for this test
 */
function setupConsoleSpy(client, taskId) {

  // Debug logging for console spy setup
  const debugConsoleSpy = process.env.TD_DEBUG_CONSOLE_SPY === 'true';
  if (debugConsoleSpy) {
    process.stdout.write(`[DEBUG setupConsoleSpy] taskId: ${taskId}\n`);
    process.stdout.write(`[DEBUG setupConsoleSpy] client.sandbox exists: ${!!client.sandbox}\n`);
    process.stdout.write(`[DEBUG setupConsoleSpy] client.sandbox?.instanceSocketConnected: ${client.sandbox?.instanceSocketConnected}\n`);
    process.stdout.write(`[DEBUG setupConsoleSpy] client.sandbox?.send: ${typeof client.sandbox?.send}\n`);
  }

  // Track forwarding stats
  let forwardedCount = 0;
  let skippedCount = 0;

  // Helper to forward logs to sandbox
  const forwardToSandbox = (args) => {
    const message = args
      .map((arg) =>
        typeof arg === "object"
          ? JSON.stringify(arg, null, 2)
          : String(arg),
      )
      .join(" ");

    // Send to sandbox for immediate visibility in dashcam
    if (client.sandbox && client.sandbox.instanceSocketConnected) {
      try {
        client.sandbox.send({
          type: "output",
          output: Buffer.from(message, "utf8").toString("base64"),
        });
        forwardedCount++;
        if (debugConsoleSpy && forwardedCount <= 3) {
          process.stdout.write(`[DEBUG forwardToSandbox] Forwarded message #${forwardedCount}: "${message.substring(0, 50)}..."\n`);
        }
      } catch (err) {
        if (debugConsoleSpy) {
          process.stdout.write(`[DEBUG forwardToSandbox] Error sending: ${err.message}\n`);
        }
      }
    } else {
      skippedCount++;
      if (debugConsoleSpy && skippedCount <= 3) {
        process.stdout.write(`[DEBUG forwardToSandbox] SKIPPED (sandbox not connected): "${message.substring(0, 50)}..."\n`);
      }
    }
  };

  // Store original console methods before spying
  const originalLog = console.log.bind(console);
  const originalError = console.error.bind(console);
  const originalWarn = console.warn.bind(console);
  const originalInfo = console.info.bind(console);

  // Create spies for each console method
  const logSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
    originalLog(...args);  // Call original (Vitest will capture this)
    forwardToSandbox(args);
  });

  const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
    originalError(...args);
    forwardToSandbox(args);
  });

  const warnSpy = vi.spyOn(console, 'warn').mockImplementation((...args) => {
    originalWarn(...args);
    forwardToSandbox(args);
  });

  const infoSpy = vi.spyOn(console, 'info').mockImplementation((...args) => {
    originalInfo(...args);
    forwardToSandbox(args);
  });

  // Store spies on client for cleanup
  client._consoleSpies = { logSpy, errorSpy, warnSpy, infoSpy };

}

/**
 * Clean up console spies and restore original console methods
 * @param {TestDriver} client - TestDriver client instance
 */
function cleanupConsoleSpy(client) {
  if (client._consoleSpies) {
    const { logSpy, errorSpy, warnSpy, infoSpy } = client._consoleSpies;
    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    infoSpy.mockRestore();
    delete client._consoleSpies;
  }
}

// Weak maps to store instances per test context
const testDriverInstances = new WeakMap();
const lifecycleHandlers = new WeakMap();

/**
 * Create a TestDriver client in a Vitest test with automatic lifecycle management
 * 
 * @param {object} context - Vitest test context (from async (context) => {})
 * @param {object} options - TestDriver options (passed directly to TestDriver constructor)
 * @param {string} [options.apiKey] - TestDriver API key (defaults to process.env.TD_API_KEY)
 * @param {boolean} [options.headless] - Run sandbox in headless mode
 * @param {boolean} [options.newSandbox] - Create new sandbox
 * @param {number} [options.timeout=0] - Sandbox timeout (TTL) in milliseconds. 0 = use provider default (5 min for E2B Linux)
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
  
  // Return existing instance if already created for this test
  if (testDriverInstances.has(context.task)) {
    return testDriverInstances.get(context.task);
  }
  
  // Get global plugin options if available
  const pluginOptions = globalThis.__testdriverPlugin?.state?.testDriverOptions || {};
  
  // Merge options: plugin global options < test-specific options
  const mergedOptions = { ...pluginOptions, ...options };
  
  // Support TD_OS environment variable for specifying target OS (linux, mac, windows)
  // Priority: test options > plugin options > environment variable > default (linux)
  if (!mergedOptions.os && process.env.TD_OS) {
    mergedOptions.os = process.env.TD_OS;
    console.log(`[testdriver] Set mergedOptions.os = ${mergedOptions.os} from TD_OS environment variable`);
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
  testdriver.__vitestContext = context.task;
  testDriverInstances.set(context.task, testdriver);
  
  // Auto-connect if enabled (default: true)
  const autoConnect = config.autoConnect !== undefined ? config.autoConnect : true;
  const debugConsoleSpy = process.env.TD_DEBUG_CONSOLE_SPY === 'true';
  
  if (autoConnect) {
    testdriver.__connectionPromise = (async () => {
        console.log('[testdriver] Connecting to sandbox...');
        if (debugConsoleSpy) {
          console.log('[DEBUG] Before auth - sandbox.instanceSocketConnected:', testdriver.sandbox?.instanceSocketConnected);
        }
        
        await testdriver.auth();
        await testdriver.connect();
                
        if (debugConsoleSpy) {
          console.log('[DEBUG] After connect - sandbox.instanceSocketConnected:', testdriver.sandbox?.instanceSocketConnected);
          console.log('[DEBUG] After connect - sandbox.send:', typeof testdriver.sandbox?.send);
        }
        
        // Set up console spy using vi.spyOn (test-isolated)
        setupConsoleSpy(testdriver, context.task.id);
        
        // Create the log file on the remote machine
        const shell = testdriver.os === "windows" ? "pwsh" : "sh";
        const logPath = testdriver.os === "windows" 
          ? "C:\\Users\\testdriver\\Documents\\testdriver.log"
          : "/tmp/testdriver.log";
        
        const createLogCmd = testdriver.os === "windows"
          ? `New-Item -ItemType File -Path "${logPath}" -Force | Out-Null`
          : `touch ${logPath}`;
        
        await testdriver.exec(shell, createLogCmd, 10000, true);
        
        // Add automatic log tracking when dashcam starts
        // Store original start method

        await testdriver.dashcam.addFileLog(logPath, "TestDriver Log");

    })();
  }
  
  // Register cleanup handler with dashcam.stop()
  if (!lifecycleHandlers.has(context.task)) {
    const cleanup = async () => {
      try {
        // Stop dashcam if it was started - with timeout to prevent hanging
        if (testdriver._dashcam && testdriver._dashcam.recording) {
          try {
            const dashcamUrl = await testdriver.dashcam.stop();
            console.log('');
            console.log('🎥' + chalk.yellow(` Dashcam URL`) + `: ${dashcamUrl}`);
            console.log('');
            // Write test result to file for the reporter (cross-process communication)
            // This should happen regardless of whether dashcam succeeded, to ensure platform info is available
            const testId = context.task.id;
            const platform = testdriver.os || 'linux';
            const absolutePath = context.task.file?.filepath || context.task.file?.name || 'unknown';
            const projectRoot = process.cwd();
            const testFile = absolutePath !== 'unknown'
              ? path.relative(projectRoot, absolutePath)
              : absolutePath;
            
            // Create results directory if it doesn't exist
            const resultsDir = path.join(os.tmpdir(), 'testdriver-results');
            if (!fs.existsSync(resultsDir)) {
              fs.mkdirSync(resultsDir, { recursive: true });
            }
            
            // Write test result file
            const testResultFile = path.join(resultsDir, `${testId}.json`);
            const testResult = {
              dashcamUrl: dashcamUrl || null,
              platform,
              testFile,
              testOrder: 0,
              sessionId: testdriver.getSessionId(),
            };
            
            fs.writeFileSync(testResultFile, JSON.stringify(testResult, null, 2));
            
            // Also register in memory if plugin is available
            if (globalThis.__testdriverPlugin?.registerDashcamUrl) {
              globalThis.__testdriverPlugin.registerDashcamUrl(testId, dashcamUrl, platform);
            }
          } catch (error) {
            // Log more detailed error information for debugging
            console.error('❌ Failed to stop dashcam:', error.name || error.constructor?.name || 'Error');
            if (error.message) console.error('   Message:', error.message);
            // NotFoundError during cleanup is expected if sandbox already terminated
            if (error.name === 'NotFoundError' || error.responseData?.error === 'NotFoundError') {
              console.log('   ℹ️  Sandbox session already terminated - dashcam stop skipped');
            }
            // Mark as not recording to prevent retries
            if (testdriver._dashcam) {
              testdriver._dashcam.recording = false;
            }
          }
        }
        
        // Clean up console spies
        cleanupConsoleSpy(testdriver);
        
        // Wait for connection to finish if it was initiated
        if (testdriver.__connectionPromise) {
          await testdriver.__connectionPromise.catch(() => {}); // Ignore connection errors during cleanup
        }
        
        // Disconnect with timeout
        await Promise.race([
          testdriver.disconnect(),
          new Promise((resolve) => setTimeout(resolve, 5000)) // 5s timeout for disconnect
        ]);
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
