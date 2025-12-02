/**
 * TestDriver Vitest Integration
 * 
 * Main entry point for the TestDriver Vitest plugin.
 * 
 * @example
 * // Basic usage - auto-managed lifecycle
 * import { TestDriver } from 'testdriverai/vitest';
 * 
 * test('my test', async (context) => {
 *   const testdriver = TestDriver(context, { headless: true });
 *   await testdriver.provision.chrome({ url: 'https://example.com' });
 *   await testdriver.find('Login button').click();
 * });
 * 
 * @example
 * // With extended test functions (it.once for setup steps)
 * import { describe, it, expect, TestDriver } from 'testdriverai/vitest';
 * 
 * describe('My Suite', () => {
 *   it.once('launch app', async (context) => {
 *     const testdriver = TestDriver(context);
 *     await testdriver.provision.chrome({ url: 'https://example.com' });
 *   });
 *   
 *   it('click button', async (context) => {
 *     const testdriver = TestDriver(context);
 *     await testdriver.find('Button').click();
 *   });
 * });
 * 
 * @example
 * // Using lifecycle helpers directly
 * import { TestDriver, launchChrome, waitForPage } from 'testdriverai/vitest';
 * 
 * test('custom setup', async (context) => {
 *   const testdriver = TestDriver(context);
 *   await testdriver.ready();
 *   await launchChrome(testdriver, 'https://example.com', { guest: true });
 *   await waitForPage(testdriver, 'Welcome');
 * });
 */

// Core TestDriver hook and cleanup
export { TestDriver, createTestDriver, registerTest, cleanupTestDriver } from './hooks.mjs';

// Extended Vitest functions
export {
    afterAll, beforeAll, describe, expect, getTestDriver,
    isReconnected, it,
    test
} from './extended.mjs';

// Lifecycle helpers
export {
    addDashcamLog, authDashcam, launchChrome, launchChromeExtension, launchChromeForTesting, runPostrun, runPrerun, runPrerunChromeExtension, runPrerunChromeForTesting, startDashcam,
    stopDashcam, waitForPage
} from './lifecycle.mjs';

// Utility functions
export {
    generateTestId, retryAsync, setupEventLogging, sleep, waitFor
} from './utils.mjs';

