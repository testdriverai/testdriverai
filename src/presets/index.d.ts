/**
 * TypeScript definitions for TestDriver Presets
 * @module testdriverai/presets
 */

import { TestDriver, Dashcam } from '../core/index';
import { VitestContext } from '../vitest/hooks';

/**
 * Common preset options
 */
export interface PresetOptions {
  /**
   * Target OS: 'linux', 'mac', or 'windows'
   */
  os?: 'linux' | 'mac' | 'windows';
  
  /**
   * Enable Dashcam recording (default: true)
   */
  dashcam?: boolean;
}

/**
 * Chrome preset options
 */
export interface ChromePresetOptions extends PresetOptions {
  /**
   * URL to navigate to
   */
  url?: string;
  
  /**
   * Start maximized (default: true)
   */
  maximized?: boolean;
  
  /**
   * Use guest mode (default: true)
   */
  guest?: boolean;
}

/**
 * Chrome preset result
 */
export interface ChromePresetResult {
  client: TestDriver;
  browser: TestDriver;
  dashcam: Dashcam | null;
}

/**
 * Chrome Browser Preset
 * Automatically sets up Chrome with TestDriver and Dashcam
 * 
 * @param context - Vitest test context
 * @param options - Preset options
 * @returns Promise with client, browser, and dashcam
 * 
 * @example
 * test('login test', async (context) => {
 *   const { browser } = await chromePreset(context, {
 *     url: 'https://myapp.com/login'
 *   });
 *   
 *   await browser.find('email input').type('user@example.com');
 * });
 */
export function chromePreset(context: VitestContext, options?: ChromePresetOptions): Promise<ChromePresetResult>;

/**
 * VS Code preset options
 */
export interface VSCodePresetOptions extends PresetOptions {
  /**
   * Workspace/folder to open
   */
  workspace?: string | null;
  
  /**
   * Extensions to install (array of extension IDs)
   */
  extensions?: string[];
}

/**
 * VS Code preset result
 */
export interface VSCodePresetResult {
  client: TestDriver;
  vscode: TestDriver;
  dashcam: Dashcam | null;
}

/**
 * VS Code Preset
 * Automatically sets up VS Code with TestDriver and Dashcam
 * 
 * @param context - Vitest test context
 * @param options - Preset options
 * @returns Promise with client, vscode, and dashcam
 * 
 * @example
 * test('extension test', async (context) => {
 *   const { vscode } = await vscodePreset(context, {
 *     workspace: '/tmp/test-project',
 *     extensions: ['ms-python.python']
 *   });
 *   
 *   await vscode.find('File menu').click();
 * });
 */
export function vscodePreset(context: VitestContext, options?: VSCodePresetOptions): Promise<VSCodePresetResult>;

/**
 * Electron preset options
 */
export interface ElectronPresetOptions extends PresetOptions {
  /**
   * Path to Electron app (required)
   */
  appPath: string;
  
  /**
   * Additional electron arguments
   */
  args?: string[];
}

/**
 * Electron preset result
 */
export interface ElectronPresetResult {
  client: TestDriver;
  app: TestDriver;
  dashcam: Dashcam | null;
}

/**
 * Electron App Preset
 * Automatically sets up an Electron application with TestDriver
 * 
 * @param context - Vitest test context
 * @param options - Preset options
 * @returns Promise with client, app, and dashcam
 * 
 * @example
 * test('my test', async (context) => {
 *   const { app } = await electronPreset(context, {
 *     appPath: '/path/to/electron/app'
 *   });
 *   
 *   await app.find('main window').click();
 * });
 */
export const electronPreset: (context: VitestContext, options: ElectronPresetOptions) => Promise<ElectronPresetResult>;

/**
 * Web app preset options
 */
export interface WebAppPresetOptions extends ChromePresetOptions {
  /**
   * Browser to use (only 'chrome' currently supported)
   */
  browser?: 'chrome';
}

/**
 * Web App Preset
 * Simplified preset for any web application
 * 
 * @param context - Vitest test context
 * @param options - Preset options
 * @returns Promise with client, browser, and dashcam
 */
export function webAppPreset(context: VitestContext, options?: WebAppPresetOptions): Promise<ChromePresetResult>;

/**
 * Preset setup function signature
 */
export type PresetSetupFunction = (
  context: VitestContext,
  client: TestDriver,
  dashcam: Dashcam | null,
  options: any
) => Promise<Record<string, any>>;

/**
 * Preset configuration
 */
export interface PresetConfig {
  /**
   * Preset name (for error messages)
   */
  name: string;
  
  /**
   * Default options
   */
  defaults?: Record<string, any>;
  
  /**
   * Setup function
   */
  setup: PresetSetupFunction;
}

/**
 * Create a custom preset
 * Builder function for creating your own presets
 * 
 * @param config - Preset configuration
 * @returns Preset function
 * 
 * @example
 * const firefoxPreset = createPreset({
 *   name: 'Firefox Browser',
 *   defaults: { os: 'linux', dashcam: true },
 *   async setup(context, client, dashcam, options) {
 *     const { url } = options;
 *     await client.exec('sh', `firefox "${url}" &`, 30000);
 *     await client.focusApplication('Firefox');
 *     return { browser: client };
 *   }
 * });
 */
export function createPreset(config: PresetConfig): (context: VitestContext, options?: any) => Promise<any>;
