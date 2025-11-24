/**
 * TestDriver Presets
 * 
 * Pre-configured setups for common applications and workflows.
 * Presets encapsulate best practices and reduce boilerplate.
 * 
 * @example
 * import { chromePreset } from 'testdriverai/presets';
 * 
 * test('my test', async (context) => {
 *   const { client, browser } = await chromePreset(context, {
 *     url: 'https://example.com'
 *   });
 *   
 *   await browser.find('Login').click();
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
 * @returns {Promise<{client: TestDriver, browser: TestDriver, dashcam: Dashcam}>}
 * 
 * @example
 * test('login test', async (context) => {
 *   const { browser } = await chromePreset(context, {
 *     url: 'https://myapp.com/login'
 *   });
 *   
 *   await browser.find('email input').type('user@example.com');
 *   await browser.find('password input').type('password123');
 *   await browser.find('Login button').click();
 * });
 */
export async function chromePreset(context, options = {}) {
  const {
    url = 'http://testdriver-sandbox.vercel.app/',
    os = 'linux',
    dashcam: enableDashcam = true,
    maximized = true,
    guest = true,
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
  }

  // Build Chrome launch command
  const chromeArgs = [];
  if (maximized) chromeArgs.push('--start-maximized');
  if (guest) chromeArgs.push('--guest');
  chromeArgs.push('--disable-fre', '--no-default-browser-check', '--no-first-run');

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
      `google-chrome ${argsString} "${url}" >/dev/null 2>&1 &`,
      30000
    );
  }

  // Wait for Chrome to be ready
  await client.focusApplication('Google Chrome');

  return {
    client,
    browser: client, // Alias for semantic clarity
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
 *   const { vscode } = await vscodePreset(context, {
 *     workspace: '/tmp/test-project',
 *     extensions: ['ms-python.python']
 *   });
 *   
 *   await vscode.find('File menu').click();
 *   await vscode.find('New File').click();
 * });
 */
export async function vscodePreset(context, options = {}) {
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
    client,
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
 * const electronPreset = createPreset({
 *   name: 'Electron App',
 *   defaults: { os: 'linux', dashcam: true },
 *   async setup(context, client, dashcam, options) {
 *     await client.exec('sh', `electron ${options.appPath} &`, 30000);
 *     await client.focusApplication('Electron');
 *     return { client, app: client, dashcam };
 *   }
 * });
 * 
 * // Use your custom preset
 * test('my test', async (context) => {
 *   const { app } = await electronPreset(context, { appPath: './dist' });
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
    }

    // Call user's setup function
    const result = await setup(context, client, dashcam, finalOptions);

    // Ensure we return at least client and dashcam
    return {
      client,
      dashcam,
      ...result,
    };
  };
}

/**
 * Electron App Preset
 * Automatically sets up an Electron application with TestDriver
 * 
 * @param {object} context - Vitest test context
 * @param {object} options - Preset options
 * @param {string} options.appPath - Path to Electron app
 * @param {string} options.os - Target OS (default: 'linux')
 * @param {boolean} options.dashcam - Enable Dashcam recording (default: true)
 * @param {string[]} options.args - Additional electron args
 * @returns {Promise<{client: TestDriver, app: TestDriver, dashcam: Dashcam}>}
 */
export const electronPreset = createPreset({
  name: 'Electron App',
  defaults: { os: 'linux', dashcam: true, args: [] },
  async setup(context, client, dashcam, options) {
    const { appPath, args = [], os } = options;
    
    if (!appPath) {
      throw new Error('electronPreset requires appPath option');
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
      app: client,
    };
  },
});

/**
 * Web App Preset (generic browser)
 * Simplified preset for any web application
 * 
 * @param {object} context - Vitest test context
 * @param {object} options - Preset options
 * @param {string} options.url - URL to navigate to (required)
 * @param {string} options.browser - Browser to use: 'chrome', 'firefox', 'edge' (default: 'chrome')
 * @param {string} options.os - Target OS (default: 'linux')
 * @param {boolean} options.dashcam - Enable Dashcam recording (default: true)
 * @returns {Promise<{client: TestDriver, browser: TestDriver, dashcam: Dashcam}>}
 */
export async function webAppPreset(context, options = {}) {
  const { browser = 'chrome', ...restOptions } = options;
  
  // Currently only Chrome is implemented
  if (browser === 'chrome') {
    return chromePreset(context, restOptions);
  }
  
  throw new Error(`Browser "${browser}" not yet implemented. Use 'chrome' for now.`);
}
