/**
 * TestDriver Presets
 * 
 * DEPRECATED: These presets are maintained for backwards compatibility.
 * New code should use the simpler API:
 * 
 * @example
 * import { TestDriver } from 'testdriverai/vitest/hooks';
 * 
 * test('my test', async (context) => {
 *   const testdriver = TestDriver(context, { headless: true });
 *   
 *   await testdriver.connected();
 *   await testdriver.dashcam.start();
 *   await testdriver.provision.chrome({ url: 'https://example.com' });
 *   await testdriver.find('Login').click();
 *   await testdriver.dashcam.stop();
 * });
 */

import { TestDriver } from '../vitest/hooks.mjs';

/**
 * Chrome Browser Preset (DEPRECATED)
 * Use testdriver.provision.chrome() instead
 */
export async function chrome(context, options = {}) {
  console.warn('[chrome preset] DEPRECATED: Use TestDriver() + testdriver.provision.chrome() instead');
  
  const {
    url = 'http://testdriver-sandbox.vercel.app/',
    dashcam: enableDashcam = false,
    ...testDriverOptions
  } = options;

  const testdriver = TestDriver(context, testDriverOptions);
  
  // Wait for connection to complete if autoConnect was enabled
  if (testdriver.__connectionPromise) {
    await testdriver.__connectionPromise;
  }

  if (enableDashcam) {
    await testdriver.dashcam.start();
  }

  await testdriver.provision.chrome({ url });

  return {
    testdriver: testdriver,
    dashcam: enableDashcam ? testdriver.dashcam : null,
  };
}

/**
 * VS Code Preset
 * Automatically sets up VS Code with TestDriver and Dashcam
 * 
 * @param {object} context - Vitest test context
 * @param {object} options - Preset options (accepts all useTestDriver options)
 * @param {string} [options.workspace] - Workspace/folder to open
 * @param {string[]} [options.extensions=[]] - Extensions to install
 * @param {boolean} [options.dashcam=true] - Enable Dashcam recording
 * @param {boolean} [options.reconnect=false] - Reconnect to existing sandbox
 * @param {string} [options.os='linux'] - Target OS (linux/mac/windows)
 * @param {string} [options.apiKey] - TestDriver API key
 * @param {string} [options.apiRoot] - API endpoint
 * @param {boolean} [options.autoConnect=true] - Automatically connect to sandbox
 * @returns {Promise<{testdriver: TestDriver, vscode: TestDriver, dashcam: Dashcam}>}
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
  // Extract vscode-specific options
  const {
    workspace = null,
    dashcam: enableDashcam = true,
    extensions = [],
    // All other options are passed directly to useTestDriver
    ...testDriverOptions
  } = options;

  // Set up TestDriver client - all options pass through directly
  const client = TestDriver(context, testDriverOptions);
  
  // Wait for client to connect (if autoConnect was enabled)
  if (client.__connectionPromise) {
    await client.__connectionPromise;
  }

  // Set up Dashcam if enabled (dashcam is built into TestDriver)
  if (enableDashcam) {
    await client.dashcam.start();
  }

  // Install extensions if provided
  for (const extension of extensions) {
    const os = testDriverOptions.os || 'linux';
    const shell = os === 'windows' ? 'pwsh' : 'sh';
    await client.exec(
      shell,
      `code --install-extension ${extension}`,
      60000,
      true
    );
  }

  // Launch VS Code
  const os = testDriverOptions.os || 'linux';
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
    dashcam: enableDashcam ? client.dashcam : null,
  };
}

/**
 * Create a custom preset
 * Builder function for creating your own presets
 * 
 * @param {object} config - Preset configuration
 * @param {Function} config.setup - Setup function (async)
 * @param {string} config.name - Preset name
 * @param {object} config.defaults - Default options (accepts all useTestDriver options)
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
 *   const { app } = await myElectronPreset(context, { 
 *     appPath: './dist',
 *     reconnect: true  // All useTestDriver options work!
 *   });
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
      dashcam: enableDashcam = true,
      // All other options are passed directly to TestDriver
      ...testDriverOptions
    } = finalOptions;

    // Set up TestDriver client - all options pass through directly
    const client = TestDriver(context, testDriverOptions);
    
    // Wait for client to connect (if autoConnect was enabled)
    if (client.__connectionPromise) {
      await client.__connectionPromise;
    }

    // Set up Dashcam if enabled (dashcam is built into TestDriver)
    if (enableDashcam) {
      await client.dashcam.start();
    }

    // Call user's setup function
    const result = await setup(context, client, enableDashcam ? client.dashcam : null, finalOptions);

    // Ensure we return testdriver and dashcam
    return {
      testdriver: client,
      dashcam: enableDashcam ? client.dashcam : null,
      ...result,
    };
  };
}

/**
 * Run Electron App
 * Automatically sets up an Electron application with TestDriver
 * 
 * @param {object} context - Vitest test context
 * @param {object} options - Preset options (accepts all useTestDriver options)
 * @param {string} options.appPath - Path to Electron app (required)
 * @param {string[]} [options.args=[]] - Additional electron args
 * @param {boolean} [options.dashcam=true] - Enable Dashcam recording
 * @param {boolean} [options.reconnect=false] - Reconnect to existing sandbox
 * @param {string} [options.os='linux'] - Target OS (linux/mac/windows)
 * @param {string} [options.apiKey] - TestDriver API key
 * @param {string} [options.apiRoot] - API endpoint
 * @param {boolean} [options.autoConnect=true] - Automatically connect to sandbox
 * @returns {Promise<{testdriver: TestDriver, app: TestDriver, dashcam: Dashcam}>}
 */
export const electron = createPreset({
  name: 'Electron App',
  defaults: { dashcam: true, args: [] },
  async setup(context, client, dashcam, options) {
    const { appPath, args = [], os = 'linux' } = options;
    
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
 * @param {object} options - Preset options (accepts all useTestDriver options)
 * @param {string} options.url - URL to navigate to (required)
 * @param {string} [options.browser='chrome'] - Browser to use: 'chrome', 'firefox', 'edge'
 * @param {boolean} [options.reconnect=false] - Reconnect to existing sandbox
 * @param {string} [options.os='linux'] - Target OS (linux/mac/windows)
 * @param {boolean} [options.dashcam=true] - Enable Dashcam recording
 * @returns {Promise<{testdriver: TestDriver, dashcam: Dashcam}>}
 */
export async function webApp(context, options = {}) {
  const { browser = 'chrome', ...restOptions } = options;
  
  // Currently only Chrome is implemented
  // All options are automatically forwarded to the browser preset
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
