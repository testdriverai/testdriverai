/**
 * TypeScript definitions for TestDriver Vitest Hooks
 * @module testdriverai/vitest/hooks
 */

import type TestDriverSDK from '../../sdk';
import type { TestDriverOptions } from '../../sdk';

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
 * Options for TestDriver hook (includes all TestDriverOptions)
 */
export interface TestDriverHookOptions extends TestDriverOptions {
  // All TestDriverOptions are already included via extends
}

/**
 * Create a TestDriver client for use in Vitest tests
 * Manages lifecycle automatically (connects on first use, disconnects after test)
 * 
 * @param context - Vitest test context (from async (context) => {})
 * @param options - TestDriver options
 * @returns TestDriver SDK instance
 * 
 * @example
 * import { describe, expect, it } from "vitest";
 * import { TestDriver } from "testdriverai/lib/vitest/hooks.mjs";
 * 
 * describe("My Test Suite", () => {
 *   it("should do something", async (context) => {
 *     const testdriver = TestDriver(context, { newSandbox: true, headless: false });
 *     
 *     await testdriver.provision.chrome({ url: 'https://example.com' });
 *     
 *     const button = await testdriver.find("Sign In button");
 *     await button.click();
 *     
 *     const result = await testdriver.assert("the dashboard is visible");
 *     expect(result).toBeTruthy();
 *   });
 * });
 */
export function TestDriver(context: VitestContext, options?: TestDriverHookOptions): TestDriverSDK;
