/**
 * TypeScript definitions for TestDriver Vitest Hooks
 * @module testdriverai/vitest/hooks
 */

import { TestDriver, Dashcam, TestDriverOptions, DashcamOptions } from '../core/index';

/**
 * Vitest test context (from test function parameter)
 */
export interface VitestContext {
  /**
   * Current test task
   */
  task: any;
  
  /**
   * Register cleanup handler
   */
  onTestFinished?: (fn: () => void | Promise<void>) => void;
}

/**
 * Options for useTestDriver hook
 */
export interface UseTestDriverOptions extends TestDriverOptions {
  /**
   * Automatically connect to sandbox (default: true)
   */
  autoConnect?: boolean;
  
  /**
   * Create new sandbox (default: true)
   */
  new?: boolean;
}

/**
 * Options for useDashcam hook
 */
export interface UseDashcamOptions extends DashcamOptions {
  /**
   * Automatically authenticate (default: true)
   */
  autoAuth?: boolean;
  
  /**
   * Automatically start recording (default: false)
   */
  autoStart?: boolean;
  
  /**
   * Automatically stop recording at test end (default: false)
   */
  autoStop?: boolean;
}

/**
 * Use TestDriver client in a test
 * Creates and manages TestDriver instance for the current test
 * 
 * @param context - Vitest test context (from async (context) => {})
 * @param options - TestDriver options
 * @returns TestDriver client instance
 * 
 * @example
 * test('my test', async (context) => {
 *   const client = useTestDriver(context, { os: 'linux' });
 *   await client.find('Login button').click();
 * });
 */
export function useTestDriver(context: VitestContext, options?: UseTestDriverOptions): TestDriver;

/**
 * Use Dashcam in a test
 * Creates and manages Dashcam instance for the current test
 * 
 * @param context - Vitest test context
 * @param client - TestDriver client instance (from useTestDriver)
 * @param options - Dashcam options
 * @returns Dashcam instance
 * 
 * @example
 * test('my test', async (context) => {
 *   const client = useTestDriver(context);
 *   const dashcam = useDashcam(context, client, {
 *     autoStart: true,
 *     autoStop: true
 *   });
 *   
 *   await client.find('button').click();
 * });
 */
export function useDashcam(context: VitestContext, client: TestDriver, options?: UseDashcamOptions): Dashcam;

/**
 * Use TestDriver with Dashcam in one call
 * Combined hook for the simplest usage pattern
 * 
 * @param context - Vitest test context
 * @param options - Combined options for TestDriver and Dashcam
 * @returns Object with client and dashcam instances
 * 
 * @example
 * test('my test', async (context) => {
 *   const { client, dashcam } = useTestDriverWithDashcam(context, {
 *     os: 'linux'
 *   });
 *   
 *   await client.find('button').click();
 * });
 */
export function useTestDriverWithDashcam(
  context: VitestContext,
  options?: UseTestDriverOptions & UseDashcamOptions
): {
  client: TestDriver;
  dashcam: Dashcam;
};
