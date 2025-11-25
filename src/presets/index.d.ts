/**
 * TypeScript definitions for TestDriver Presets
 * @module testdriverai/presets
 */

import { Dashcam, TestDriver } from '../core/index';
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
  testdriver: TestDriver;
  dashcam: Dashcam | null;
}

/**
 * Chrome Browser Preset
 * Automatically sets up Chrome with TestDriver and Dashcam
 * 
 * @param context - Vitest test context
 * @param options - Preset options
 * @returns Promise with testdriver and dashcam
 * 
 * @example
 * test('login test', async (context) => {
 *   const { testdriver } = await chromePreset(context, {
 *     url: 'https://myapp.com/login'
 *   });
 *   
 *   await testdriver.find('email input').type('user@example.com');
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
  testdriver: TestDriver;
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
 *   const { testdriver, vscode } = await vscodePreset(context, {
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
  testdriver: TestDriver;
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
 *   const { testdriver, app } = await electronPreset(context, {
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
 * @returns Promise with testdriver and dashcam
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

/**
 * Application type for provision() function
 */
export type AppType = 'chrome' | 'vscode' | 'electron' | 'webapp';

/**
 * Provision application preset
 * Main entry point for provisioning any application preset
 * 
 * @param app - Application type
 * @param options - Preset options (varies by app type)
 * @param context - Vitest test context
 * @returns Promise with testdriver and other app-specific properties
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
export function provision(
  app: 'chrome',
  options: ChromePresetOptions,
  context: VitestContext
): Promise<ChromePresetResult>;
export function provision(
  app: 'vscode',
  options: VSCodePresetOptions,
  context: VitestContext
): Promise<VSCodePresetResult>;
export function provision(
  app: 'electron',
  options: ElectronPresetOptions,
  context: VitestContext
): Promise<ElectronPresetResult>;
export function provision(
  app: 'webapp',
  options: WebAppPresetOptions,
  context: VitestContext
): Promise<ChromePresetResult>;
export function provision(
  app: AppType,
  options: any,
  context: VitestContext
): Promise<any>;

/**
 * Chrome browser preset (can also use run(context, 'chrome', options))
 */
export function chrome(context: VitestContext, options?: ChromePresetOptions): Promise<ChromePresetResult>;

/**
 * VS Code preset (can also use run(context, 'vscode', options))
 */
export function vscode(context: VitestContext, options?: VSCodePresetOptions): Promise<VSCodePresetResult>;

/**
 * Electron preset (can also use run(context, 'electron', options))
 */
export const electron: (context: VitestContext, options: ElectronPresetOptions) => Promise<ElectronPresetResult>;

/**
 * Web app preset (can also use run(context, 'webapp', options))
 */
export function webApp(context: VitestContext, options?: WebAppPresetOptions): Promise<ChromePresetResult>;
