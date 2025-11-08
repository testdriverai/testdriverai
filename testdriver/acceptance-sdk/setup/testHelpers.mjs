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
  
    // AI-fixed (2025-11-07T23:55:59.427Z, attempt 1)
    
    // AI-fixed (2025-11-08T00:03:20.150Z, attempt 1)
    await healingClient.hoverText('Username', 'label above the username input field on the login form', 'click');
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
 * AI-Powered Error Recovery Wrapper
 * Wraps SDK commands with automatic error recovery similar to YAML runner's --heal mode
 * 
 * @param {TestDriver} client - TestDriver client
 * @param {Object} options - Recovery options
 * @param {number} options.maxRetries - Maximum number of recovery attempts (default: 3)
 * @param {boolean} options.captureOnError - Capture screenshot on error (default: true)
 * @param {boolean} options.writeOnRecovery - Rewrite test file with AI suggestions (default: false)
 * @param {string} options.testFilePath - Path to test file for rewriting (RECOMMENDED: use fileURLToPath(import.meta.url))
 * @param {Function} options.onError - Custom error handler callback
 * @param {Function} options.onRecovery - Callback when recovery is attempted
 * @returns {Proxy} Proxied client with error recovery
 * 
 * @example
 * import { fileURLToPath } from 'url';
 * const __filename = fileURLToPath(import.meta.url);
 * 
 * const healingClient = withErrorRecovery(client, { 
 *   maxRetries: 2,
 *   writeOnRecovery: true,
 *   testFilePath: __filename  // Explicitly specify file to rewrite
 * });
 * await healingClient.hoverText('Submit'); // Will auto-recover and rewrite test on failure
 */
export function withErrorRecovery(client, options = {}) {
  const {
    maxRetries = 3,
    captureOnError = true,
    writeOnRecovery = false,
    testFilePath = null,
    onError = null,
    onRecovery = null,
  } = options;

  // Track execution history for recovery
  const executionHistory = [];
  const errorCounts = new Map();

  // SDK methods that should be wrapped
  const commandMethods = [
    'assert', 'hoverText', 'hoverImage', 'type', 'pressKeys',
    'scroll', 'scrollUntilText', 'scrollUntilImage', 'exec',
    'waitForText', 'waitForImage', 'wait', 'remember',
    'matchImage', 'focusApplication', 'run'
  ];

  return new Proxy(client, {
    get(target, prop) {
      const original = target[prop];

      // Only wrap command methods
      if (typeof original !== 'function' || !commandMethods.includes(prop)) {
        return original;
      }

      return async function(...args) {
        const commandInfo = {
          method: prop,
          args: [...args],
          timestamp: Date.now(),
        };

        try {
          // Execute the command
          const result = await original.apply(target, args);
          
          // Track successful execution
          executionHistory.push({ ...commandInfo, status: 'success' });
          
          return result;
        } catch (error) {
          // Track failed execution
          executionHistory.push({ ...commandInfo, status: 'failed', error: error.message });

          // Create error key for tracking
          const errorKey = `${prop}:${error.message}`;
          const errorCount = (errorCounts.get(errorKey) || 0) + 1;
          errorCounts.set(errorKey, errorCount);

          // Call custom error handler if provided
          if (onError) {
            await onError(error, commandInfo, errorCount);
          }

          // Check if we've hit the retry limit
          if (errorCount >= maxRetries) {
            console.error(`❌ Error recovery failed after ${maxRetries} attempts for ${prop}`);
            console.error(`   Last error: ${error.message}`);
            console.error(`\n📋 Execution history:`);
            executionHistory.slice(-5).forEach((entry, i) => {
              const icon = entry.status === 'success' ? '✅' : '❌';
              console.error(`   ${icon} ${entry.method}(${JSON.stringify(entry.args).slice(0, 50)}...)`);
            });
            throw error;
          }

          // Attempt AI-powered recovery
          console.warn(`⚠️  Error in ${prop}: ${error.message}`);
          console.warn(`   Attempting AI recovery (attempt ${errorCount}/${maxRetries})...`);

          // Call custom recovery handler if provided
          if (onRecovery) {
            await onRecovery(error, commandInfo, errorCount);
          }

          // Capture screenshot for AI context if enabled
          let screenshot = null;
          if (captureOnError) {
            try {
              // Access system through SDK's public property
              if (target.system && typeof target.system.captureScreenBase64 === 'function') {
                screenshot = await target.system.captureScreenBase64();
              }
            } catch (screenshotError) {
              console.warn('   Failed to capture screenshot for recovery');
            }
          }

          // Request AI to resolve the error
          try {
            // Access apiClient through SDK's public property
            const response = await target.apiClient.req(
              'error',
              {
                description: error.message,
                markdown: generateErrorContext(prop, args, executionHistory, error),
                image: screenshot,
              }
            );

            if (response?.data) {
              console.warn(`   ✨ AI suggested recovery steps`);
              
              // Rewrite test file if enabled
              if (writeOnRecovery) {
                const filePath = testFilePath || detectTestFilePath();
                if (filePath) {
                  console.warn(`   📂 Target file: ${filePath}`);
                  const errorLocation = extractErrorLocation(error);
                  await rewriteTestFile(filePath, response.data, prop, args, errorCount, errorLocation);
                } else {
                  console.warn(`   ⚠️  Could not detect test file path, skipping rewrite`);
                  console.warn(`   💡 Pass testFilePath option to withErrorRecovery() to enable rewriting`);
                }
              }
              
              console.warn(`   Retrying ${prop}...`);
              
              // Retry the original command
              return await original.apply(target, args);
            }
          } catch (recoveryError) {
            console.error(`   Recovery request failed: ${recoveryError.message}`);
          }

          // If recovery failed, throw original error
          throw error;
        }
      };
    }
  });
}

/**
 * Extract file location from error stack
 * @private
 */
function extractErrorLocation(error) {
  try {
    const stack = error.stack || '';
    const lines = stack.split('\n');
    
    // Look for the first line that points to a .test. file (the actual test location)
    for (const line of lines) {
      const match = line.match(/at\s+(?:.*?\s+)?\(?(.+\.test\.(mjs|js)):(\d+):(\d+)\)?/);
      if (match) {
        return {
          file: match[1],
          line: parseInt(match[3]),
          column: parseInt(match[4]),
          raw: line.trim()
        };
      }
    }
    
    // Fallback: look for any file with line/column
    for (const line of lines) {
      const match = line.match(/at\s+(?:.*?\s+)?\(?(.+\.(mjs|js)):(\d+):(\d+)\)?/);
      if (match && !match[1].includes('node_modules') && !match[1].includes('testHelpers')) {
        return {
          file: match[1],
          line: parseInt(match[3]),
          column: parseInt(match[4]),
          raw: line.trim()
        };
      }
    }
  } catch (err) {
    // Ignore parsing errors
  }
  return null;
}

/**
 * Generate context for error recovery
 * @private
 */
function generateErrorContext(method, args, history, error) {
  const recent = history.slice(-5);
  const location = extractErrorLocation(error);
  
  let context = `Error occurred in test file`;
  
  if (location) {
    context += ` at ${location.file}:${location.line}:${location.column}`;
  }
  
  context += `

Command that failed: ${method}(${JSON.stringify(args)})
Error message: ${error.message}

${location ? `Stack trace location:\n${location.raw}\n` : ''}
Recent execution history:
${recent.map(entry => 
  `- ${entry.status === 'success' ? '✓' : '✗'} ${entry.method}(${JSON.stringify(entry.args).slice(0, 100)})`
).join('\n')}

Please suggest a fix for this error. The fix should target line ${location ? location.line : 'unknown'} in the test file.
Make sure to use the correct text/element identifiers from the screenshot.
  `.trim();
  
  return context;
}

/**
 * Detect the current test file path from stack trace
 * Uses multiple methods to reliably find the actual test file
 * @private
 */
function detectTestFilePath() {
  try {
    // Method 1: Use Error.prepareStackTrace to get structured call sites
    const originalPrepareStackTrace = Error.prepareStackTrace;
    const callSites = [];
    
    Error.prepareStackTrace = (_, stack) => stack;
    const err = new Error();
    const stack = err.stack;
    Error.prepareStackTrace = originalPrepareStackTrace;
    
    // Look through call sites for test files
    if (Array.isArray(stack)) {
      for (const site of stack) {
        const fileName = site.getFileName();
        if (fileName && fileName.match(/\.test\.(mjs|js)$/)) {
          // Exclude helper/setup files
          if (!fileName.includes('testHelpers') && !fileName.includes('/setup/')) {
            return fileName;
          }
        }
      }
    }
    
    // Method 2: Parse string stack trace
    const stackString = typeof err.stack === 'string' ? err.stack : err.stack.toString();
    const lines = stackString.split('\n');
    
    // Look for .test.mjs or .test.js files in stack (prioritize these)
    for (const line of lines) {
      // Match both formats: (file:line:col) and at file:line:col
      const match = line.match(/(?:\(|at\s+)(.+\.test\.(mjs|js)):\d+:\d+/);
      if (match) {
        const filePath = match[1];
        // Exclude helper files - only return actual test files
        if (!filePath.includes('testHelpers') && !filePath.includes('/setup/')) {
          return filePath;
        }
      }
    }
    
    // Method 3: Check import.meta.url from parent context
    // This is set when the test file is executed
    if (typeof process !== 'undefined' && process.argv) {
      const vitestFileArg = process.argv.find(arg => arg.match(/\.test\.(mjs|js)$/));
      if (vitestFileArg) {
        return vitestFileArg;
      }
    }
    
  } catch (err) {
    console.warn('   Could not auto-detect test file path:', err.message);
  }
  return null;
}

/**
 * Rewrite test file with AI-suggested fix
 * @private
 */
async function rewriteTestFile(filePath, aiResponse, method, args, attempt, errorLocation = null) {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const yaml = await import('js-yaml');
    
    console.warn(`   📝 Rewriting test file: ${path.basename(filePath)}`);
    if (errorLocation) {
      console.warn(`   📍 Target location: line ${errorLocation.line}, column ${errorLocation.column}`);
    }
    
    // Read current file
    const currentContent = fs.readFileSync(filePath, 'utf-8');
    const lines = currentContent.split('\n');
    
    // Create backup
    const backupPath = `${filePath}.backup.${Date.now()}`;
    fs.writeFileSync(backupPath, currentContent);
    console.warn(`   💾 Backup saved: ${path.basename(backupPath)}`);
    
    // Parse AI response for YAML code blocks (AI returns YAML, not JS)
    const yamlBlockMatch = aiResponse.match(/```(?:yaml|yml)?\n([\s\S]+?)\n```/);
    
    if (!yamlBlockMatch) {
      console.warn(`   ⚠️  No YAML code block found in AI response, skipping rewrite`);
      return;
    }
    
    const yamlContent = yamlBlockMatch[1];
    
    // Parse YAML to get commands
    let yamlData;
    try {
      yamlData = yaml.load(yamlContent);
    } catch (parseError) {
      console.warn(`   ⚠️  Failed to parse YAML from AI: ${parseError.message}`);
      return;
    }
    
    // Convert YAML commands to JavaScript SDK calls
    const jsCode = convertYamlCommandsToJs(yamlData);
    
    if (!jsCode) {
      console.warn(`   ⚠️  Could not convert YAML to JavaScript`);
      return;
    }
    
    let updatedContent = currentContent;
    let replacementMade = false;
    
    // Method 1: If we have error location, try to replace at that specific line
    if (errorLocation && errorLocation.line && errorLocation.line <= lines.length) {
      const targetLineIndex = errorLocation.line - 1; // Convert to 0-based index
      const targetLine = lines[targetLineIndex];
      
      // Check if this line contains the failing method
      if (targetLine.includes(`${method}(`)) {
        console.warn(`   🎯 Found method at line ${errorLocation.line}: ${targetLine.trim()}`);
        
        // Replace just this line
        const indent = targetLine.match(/^(\s*)/)[1];
        const timestamp = new Date().toISOString();
        const aiFixComment = `${indent}// AI-fixed (${timestamp}, attempt ${attempt})`;
        
        lines[targetLineIndex] = aiFixComment + '\n' + indent + jsCode.split('\n').join('\n' + indent);
        updatedContent = lines.join('\n');
        replacementMade = true;
        
        console.warn(`   ✅ Replaced line ${errorLocation.line} with AI suggestion`);
      }
    }
    
    // Method 2: Fallback to regex pattern matching if location-based didn't work
    if (!replacementMade) {
      const methodPattern = new RegExp(
        `(await\\s+(?:client|healingClient)\\.${method}\\s*\\([^)]*\\))`,
        'g'
      );
      
      if (methodPattern.test(currentContent)) {
        // Add a comment indicating AI fix
        const timestamp = new Date().toISOString();
        const aiFixComment = `\n    // AI-fixed (${timestamp}, attempt ${attempt})\n    `;
        
        updatedContent = currentContent.replace(
          methodPattern,
          (match) => {
            if (!replacementMade) {
              replacementMade = true;
              return aiFixComment + jsCode.trim();
            }
            return match;
          }
        );
      }
    }
    
    if (replacementMade) {
      fs.writeFileSync(filePath, updatedContent);
      console.warn(`   ✅ Test file updated with AI suggestion`);
      console.warn(`   💡 Review changes and restore from backup if needed`);
    } else {
      // If we can't find exact match, append suggestion as comment
      const appendix = `\n\n/* AI Recovery Suggestion (${new Date().toISOString()})
 * Original: ${method}(${JSON.stringify(args)})
 * YAML from AI:
 * ${yamlContent}
 * 
 * Converted to JS:
 * ${jsCode}
 */\n`;
      
      fs.appendFileSync(filePath, appendix);
      console.warn(`   📌 AI suggestion appended to file as comment`);
    }
    
  } catch (err) {
    console.error(`   ❌ Failed to rewrite test file: ${err.message}`);
  }
}

/**
 * Convert YAML commands to JavaScript SDK method calls
 * @private
 */
function convertYamlCommandsToJs(yamlData) {
  // Command name mapping from YAML to SDK methods
  const commandMapping = {
    'hover-text': 'hoverText',
    'hover-image': 'hoverImage',
    'match-image': 'matchImage',
    'type': 'type',
    'press-keys': 'pressKeys',
    'click': 'click',
    'hover': 'hover',
    'scroll': 'scroll',
    'scroll-until-text': 'scrollUntilText',
    'scroll-until-image': 'scrollUntilImage',
    'wait': 'wait',
    'wait-for-text': 'waitForText',
    'wait-for-image': 'waitForImage',
    'focus-application': 'focusApplication',
    'remember': 'remember',
    'assert': 'assert',
    'exec': 'exec',
    'run': 'run',
  };
  
  // Extract commands from YAML structure
  let commands = [];
  
  if (yamlData.commands) {
    commands = yamlData.commands;
  } else if (yamlData.steps) {
    // Flatten steps into commands
    yamlData.steps.forEach(step => {
      if (step.commands) {
        commands = commands.concat(step.commands);
      }
    });
  }
  
  if (!commands.length) {
    return null;
  }
  
  // Convert each command to JavaScript
  const jsLines = commands.map(cmd => {
    const yamlCommand = cmd.command;
    const jsMethod = commandMapping[yamlCommand];
    
    if (!jsMethod) {
      return `// Unknown command: ${yamlCommand}`;
    }
    
    // Build arguments based on command type
    const args = buildArgumentsForCommand(yamlCommand, cmd);
    
    return `await healingClient.${jsMethod}(${args.join(', ')})`;
  });
  
  return jsLines.join(';\n    ');
}

/**
 * Build JavaScript arguments from YAML command object
 * @private
 */
function buildArgumentsForCommand(command, cmdObj) {
  const args = [];
  
  switch(command) {
    case 'hover-text':
      if (cmdObj.text) args.push(`'${cmdObj.text}'`);
      if (cmdObj.description) args.push(`'${cmdObj.description}'`);
      if (cmdObj.action) args.push(`'${cmdObj.action}'`);
      if (cmdObj.method) args.push(`'${cmdObj.method}'`);
      if (cmdObj.timeout) args.push(cmdObj.timeout);
      break;
      
    case 'hover-image':
      if (cmdObj.description) args.push(`'${cmdObj.description}'`);
      if (cmdObj.action) args.push(`'${cmdObj.action}'`);
      break;
      
    case 'match-image':
      if (cmdObj.path) args.push(`'${cmdObj.path}'`);
      if (cmdObj.action) args.push(`'${cmdObj.action}'`);
      if (cmdObj.invert !== undefined) args.push(cmdObj.invert);
      break;
      
    case 'type':
      if (cmdObj.text !== undefined) args.push(`'${cmdObj.text}'`);
      else if (cmdObj.string !== undefined) args.push(`'${cmdObj.string}'`);
      if (cmdObj.delay) args.push(cmdObj.delay);
      break;
      
    case 'press-keys':
      if (cmdObj.keys) {
        const keys = Array.isArray(cmdObj.keys) ? cmdObj.keys : [cmdObj.keys];
        args.push(`[${keys.map(k => `'${k}'`).join(', ')}]`);
      }
      break;
      
    case 'click':
      if (cmdObj.x !== undefined) args.push(cmdObj.x);
      if (cmdObj.y !== undefined) args.push(cmdObj.y);
      if (cmdObj.action) args.push(`'${cmdObj.action}'`);
      break;
      
    case 'hover':
      if (cmdObj.x !== undefined) args.push(cmdObj.x);
      if (cmdObj.y !== undefined) args.push(cmdObj.y);
      break;
      
    case 'scroll':
      if (cmdObj.direction) args.push(`'${cmdObj.direction}'`);
      if (cmdObj.amount) args.push(cmdObj.amount);
      if (cmdObj.method) args.push(`'${cmdObj.method}'`);
      break;
      
    case 'scroll-until-text':
      if (cmdObj.text) args.push(`'${cmdObj.text}'`);
      if (cmdObj.direction) args.push(`'${cmdObj.direction}'`);
      if (cmdObj.amount) args.push(cmdObj.amount);
      if (cmdObj.timeout) args.push(cmdObj.timeout);
      if (cmdObj.invert !== undefined) args.push(cmdObj.invert);
      break;
      
    case 'scroll-until-image':
      if (cmdObj.description) args.push(`'${cmdObj.description}'`);
      if (cmdObj.direction) args.push(`'${cmdObj.direction}'`);
      if (cmdObj.amount) args.push(cmdObj.amount);
      if (cmdObj.timeout) args.push(cmdObj.timeout);
      if (cmdObj.invert !== undefined) args.push(cmdObj.invert);
      break;
      
    case 'wait':
      if (cmdObj.timeout) args.push(cmdObj.timeout);
      break;
      
    case 'wait-for-text':
      if (cmdObj.text) args.push(`'${cmdObj.text}'`);
      if (cmdObj.timeout) args.push(cmdObj.timeout);
      break;
      
    case 'wait-for-image':
      if (cmdObj.description) args.push(`'${cmdObj.description}'`);
      if (cmdObj.timeout) args.push(cmdObj.timeout);
      break;
      
    case 'focus-application':
      if (cmdObj.name) args.push(`'${cmdObj.name}'`);
      break;
      
    case 'remember':
      if (cmdObj.description) args.push(`'${cmdObj.description}'`);
      break;
      
    case 'assert':
      if (cmdObj.expect) args.push(`'${cmdObj.expect}'`);
      if (cmdObj.async !== undefined) args.push(cmdObj.async);
      if (cmdObj.invert !== undefined) args.push(cmdObj.invert);
      break;
      
    case 'exec':
      if (cmdObj.language || cmdObj.lang) args.push(`'${cmdObj.language || cmdObj.lang}'`);
      if (cmdObj.code) args.push(`\`${cmdObj.code}\``);
      if (cmdObj.timeout) args.push(cmdObj.timeout);
      if (cmdObj.silent !== undefined) args.push(cmdObj.silent);
      break;
      
    case 'run':
      if (cmdObj.file) args.push(`'${cmdObj.file}'`);
      break;
  }
  
  return args;
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
