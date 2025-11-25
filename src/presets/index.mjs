/**
 * TestDriver Presets
 * 
 * Pre-configured setups for common applications and workflows.
 * Presets encapsulate best practices and reduce boilerplate.
 * 
 * @example
 * import { chrome } from 'testdriverai/presets';
 * 
 * test('my test', async (context) => {
 *   const { testdriver } = await chrome(context, {
 *     url: 'https://example.com'
 *   });
 *   
 *   await testdriver.find('Login').click();
 * });
 */

import { useDashcam, useTestDriver } from '../vitest/hooks.mjs';

/**
 * Chrome Browser Preset
 * Automatically sets up Chrome with TestDriver and Dashcam
 * 
 * @param {object} context - Vitest test context
 * @param {object} options - Preset options
 * @param {string} options.url - URL to navigate to (default: 'http://testdriver-sandbox.vercel.app/')
 * @param {string} options.os - Target OS (default: 'linux')
 * @param {boolean} options.dashcam - Enable Dashcam recording (default: true)
 * @param {boolean} options.maximized - Start maximized (default: true)
 * @param {boolean} options.guest - Use guest mode (default: true)
 * @returns {Promise<{client: TestDriver, dashcam: Dashcam}>}
 * 
 * @example
 * test('login test', async (context) => {
 *   const { testdriver } = await chrome(context, {
 *     url: 'https://myapp.com/login'
 *   });
 *   
 *   await testdriver.find('email input').type('user@example.com');
 *   await client.find('password input').type('password123');
 *   await client.find('Login button').click();
 * });
 */
export async function chrome(context, options = {}) {
  const {
    url = 'http://testdriver-sandbox.vercel.app/',
    os = 'linux',
    dashcam: enableDashcam = true,
    maximized = true,
    guest = false,
  } = options;

  // Set up TestDriver client
  const client = useTestDriver(context, { os });
  
  // Wait for client to connect (if autoConnect was enabled)
  if (client.__connectionPromise) {
    await client.__connectionPromise;
  }

  // Set up Dashcam if enabled
  let dashcam = null;
  if (enableDashcam) {
    dashcam = useDashcam(context, client, {
      autoAuth: true,
      autoStart: true,
      autoStop: true,
    });
    
    // Wait for Dashcam to be ready
    if (dashcam.__startPromise) {
      await dashcam.__startPromise;
    } else if (dashcam.__authPromise) {
      await dashcam.__authPromise;
    }
    
    // Track the URL domain in web mode
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const shell = os === 'windows' ? 'pwsh' : 'sh';
      await client.exec(
        shell,
        `dashcam logs --add --name=TestDriver --type=web --pattern="*${domain}*"`,
        10000
      );
      console.log(`[chrome preset] 🎥 Tracking domain "${domain}" with Dashcam`);
    } catch (e) {
      console.warn(`[chrome preset] ⚠️  Could not track URL domain:`, e.message);
    }
  }

  // Build Chrome launch command
  const chromeArgs = [];
  if (maximized) chromeArgs.push('--start-maximized');
  if (guest) chromeArgs.push('--guest');
  chromeArgs.push('--disable-fre', '--no-default-browser-check', '--no-first-run');
  
  // Add dashcam-chrome extension on Linux
  if (os === 'linux') {
    chromeArgs.push('--load-extension=/usr/lib/node_modules/dashcam-chrome/build');
  }

  // Launch Chrome
  const shell = os === 'windows' ? 'pwsh' : 'sh';
  
  if (os === 'windows') {
    const argsString = chromeArgs.map(arg => `"${arg}"`).join(', ');
    await client.exec(
      shell,
      `Start-Process "C:/Program Files/Google/Chrome/Application/chrome.exe" -ArgumentList ${argsString}, "${url}"`,
      30000
    );
  } else {
    const argsString = chromeArgs.join(' ');
    await client.exec(
      shell,
      `chrome-for-testing ${argsString} "${url}" >/dev/null 2>&1 &`,
      30000
    );
  }

  // Wait for Chrome to be ready
  await client.focusApplication('Google Chrome');

  // Extract domain from URL to wait for it to appear in the address bar
  // This prevents race conditions where tests try to interact with the URL bar before it's loaded
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    
    console.log(`[chrome preset] Waiting for domain "${domain}" to appear in URL bar...`);
    
    // Wait for the domain to appear in the address bar (with retries)
    // Poll every second for up to 30 seconds
    let found = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        // Look for just the domain in the address bar
        const result = await client.find(`${domain}`);
        if (result) {
          console.log(`[chrome preset] ✅ Found domain "${domain}" in URL bar after ${attempt + 1} attempts`);
          found = true;
          break;
        }
      } catch (e) {
        // Not found yet, continue polling
        if (attempt % 5 === 0 && attempt > 0) {
          console.log(`[chrome preset] Still waiting for domain (attempt ${attempt + 1}/30)...`);
        }
      }
      // Wait 1 second before next attempt
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (!found) {
      console.warn(`[chrome preset] ⚠️  Warning: Domain "${domain}" not found in URL bar after 30 seconds`);
      console.warn(`[chrome preset] Tests may fail if they try to interact with the address bar`);
    }
    
    // Re-focus Chrome to ensure it's visible and ready for test interactions
    await client.focusApplication('Google Chrome');
    console.log(`[chrome preset] ✅ Chrome focused and ready for testing`);
  } catch (e) {
    console.warn(`[chrome preset] ⚠️  Could not parse URL "${url}" to extract domain:`, e.message);
  }

  return {
    testdriver: client,
    dashcam,
  };
}

/**
 * VS Code Preset
 * Automatically sets up VS Code with TestDriver and Dashcam
 * 
 * @param {object} context - Vitest test context
 * @param {object} options - Preset options
 * @param {string} options.workspace - Workspace/folder to open
 * @param {string} options.os - Target OS (default: 'linux')
 * @param {boolean} options.dashcam - Enable Dashcam recording (default: true)
 * @param {string[]} options.extensions - Extensions to install
 * @returns {Promise<{client: TestDriver, vscode: TestDriver, dashcam: Dashcam}>}
 * 
 * @example
 * test('extension test', async (context) => {
 *   const { vscode } = await vscode(context, {
 *     workspace: '/tmp/test-project',
 *     extensions: ['ms-python.python']
 *   });
 *   
 *   await vscode.find('File menu').click();
 *   await vscode.find('New File').click();
 * });
 */
export async function vscode(context, options = {}) {
  const {
    workspace = null,
    os = 'linux',
    dashcam: enableDashcam = true,
    extensions = [],
  } = options;

  // Set up TestDriver client
  const client = useTestDriver(context, { os });
  
  // Wait for client to connect (if autoConnect was enabled)
  if (client.__connectionPromise) {
    await client.__connectionPromise;
  }

  // Set up Dashcam if enabled
  let dashcam = null;
  if (enableDashcam) {
    dashcam = useDashcam(context, client, {
      autoAuth: true,
      autoStart: true,
      autoStop: true,
    });
    
    // Wait for Dashcam to be ready
    if (dashcam.__startPromise) {
      await dashcam.__startPromise;
    } else if (dashcam.__authPromise) {
      await dashcam.__authPromise;
    }
  }

  // Install extensions if provided
  for (const extension of extensions) {
    const shell = os === 'windows' ? 'pwsh' : 'sh';
    await client.exec(
      shell,
      `code --install-extension ${extension}`,
      60000,
      true
    );
  }

  // Launch VS Code
  const shell = os === 'windows' ? 'pwsh' : 'sh';
  const workspaceArg = workspace ? `"${workspace}"` : '';
  
  if (os === 'windows') {
    await client.exec(
      shell,
      `Start-Process code -ArgumentList ${workspaceArg}`,
      30000
    );
  } else {
    await client.exec(
      shell,
      `code ${workspaceArg} >/dev/null 2>&1 &`,
      30000
    );
  }

  // Wait for VS Code to be ready
  await client.focusApplication('Visual Studio Code');

  return {
    testdriver: client,
    vscode: client, // Alias for semantic clarity
    dashcam,
  };
}

/**
 * Create a custom preset
 * Builder function for creating your own presets
 * 
 * @param {object} config - Preset configuration
 * @param {Function} config.setup - Setup function (async)
 * @param {string} config.name - Preset name
 * @param {object} config.defaults - Default options
 * @returns {Function} Preset function
 * 
 * @example
 * const myElectronPreset = createPreset({
 *   name: 'Electron App',
 *   defaults: { os: 'linux', dashcam: true },
 *   async setup(context, client, dashcam, options) {
 *     await client.exec('sh', `electron ${options.appPath} &`, 30000);
 *     await client.focusApplication('Electron');
 *     return { app: client };
 *   }
 * });
 * 
 * // Use your custom preset
 * test('my test', async (context) => {
 *   const { app } = await myElectronPreset(context, { appPath: './dist' });
 * });
 */
export function createPreset(config) {
  const { setup, name = 'Custom Preset', defaults = {} } = config;

  if (typeof setup !== 'function') {
    throw new Error(`Preset "${name}" requires a setup function`);
  }

  return async function preset(context, options = {}) {
    const finalOptions = { ...defaults, ...options };
    const {
      os = 'linux',
      dashcam: enableDashcam = true,
    } = finalOptions;

    // Set up TestDriver client
    const client = useTestDriver(context, { os });
    
    // Wait for client to connect (if autoConnect was enabled)
    if (client.__connectionPromise) {
      await client.__connectionPromise;
    }

    // Set up Dashcam if enabled
    let dashcam = null;
    if (enableDashcam) {
      dashcam = useDashcam(context, client, {
        autoAuth: true,
        autoStart: true,
        autoStop: true,
      });
      
      // Wait for Dashcam to be ready
      if (dashcam.__startPromise) {
        await dashcam.__startPromise;
      } else if (dashcam.__authPromise) {
        await dashcam.__authPromise;
      }
    }

    // Call user's setup function
    const result = await setup(context, client, dashcam, finalOptions);

    // Ensure we return testdriver and dashcam
    return {
      testdriver: client,
      dashcam,
      ...result,
    };
  };
}

/**
 * Run Electron App
 * Automatically sets up an Electron application with TestDriver
 * 
 * @param {object} context - Vitest test context
 * @param {object} options - Preset options
 * @param {string} options.appPath - Path to Electron app
 * @param {string} options.os - Target OS (default: 'linux')
 * @param {boolean} options.dashcam - Enable Dashcam recording (default: true)
 * @param {string[]} options.args - Additional electron args
 * @returns {Promise<{testdriver: TestDriver, app: TestDriver, dashcam: Dashcam}>}
 */
export const electron = createPreset({
  name: 'Electron App',
  defaults: { os: 'linux', dashcam: true, args: [] },
  async setup(context, client, dashcam, options) {
    const { appPath, args = [], os } = options;
    
    if (!appPath) {
      throw new Error('electron preset requires appPath option');
    }

    const shell = os === 'windows' ? 'pwsh' : 'sh';
    const argsString = args.join(' ');
    
    if (os === 'windows') {
      await client.exec(
        shell,
        `Start-Process electron -ArgumentList "${appPath}", ${argsString}`,
        30000
      );
    } else {
      await client.exec(
        shell,
        `electron "${appPath}" ${argsString} >/dev/null 2>&1 &`,
        30000
      );
    }

    await client.focusApplication('Electron');

    return {
      testdriver: client,
      app: client,
    };
  },
});

/**
 * Run Web App (generic browser)
 * Simplified preset for any web application
 * 
 * @param {object} context - Vitest test context
 * @param {object} options - Preset options
 * @param {string} options.url - URL to navigate to (required)
 * @param {string} options.browser - Browser to use: 'chrome', 'firefox', 'edge' (default: 'chrome')
 * @param {string} options.os - Target OS (default: 'linux')
 * @param {boolean} options.dashcam - Enable Dashcam recording (default: true)
 * @returns {Promise<{testdriver: TestDriver, dashcam: Dashcam}>}
 */
export async function webApp(context, options = {}) {
  const { browser = 'chrome', ...restOptions } = options;
  
  // Currently only Chrome is implemented
  if (browser === 'chrome') {
    return chrome(context, restOptions);
  }
  
  throw new Error(`Browser "${browser}" not yet implemented. Use 'chrome' for now.`);
}

/**
 * Provision application preset
 * Main entry point for provisioning any application preset
 * 
 * @param {string} app - Application type: 'chrome', 'vscode', 'electron', 'webapp'
 * @param {object} options - Preset options (varies by app type)
 * @param {object} context - Vitest test context
 * @returns {Promise<{testdriver: TestDriver, dashcam: Dashcam, ...}>}
 * 
 * @example
 * test('my test', async (context) => {
 *   const { testdriver } = await provision('chrome', {
 *     url: 'https://example.com'
 *   }, context);
 *   
 *   await testdriver.find('button').click();
 * });
 */
export async function provision(app, options = {}, context) {
  const presets = {
    chrome,
    vscode,
    electron,
    webapp: webApp,
  };
  
  const preset = presets[app.toLowerCase()];
  
  if (!preset) {
    throw new Error(`Unknown app type "${app}". Available: ${Object.keys(presets).join(', ')}`);
  }
  
  return preset(context, options);
}

// Export aliases for backwards compatibility
export const chromePreset = chrome;
export const vscodePreset = vscode;
export const electronPreset = electron;
export const webAppPreset = webApp;
