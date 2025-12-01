/**
 * Extended Vitest test functions for TestDriver
 * 
 * Provides custom test modifiers:
 * - it.once() - Only runs once per sandbox session (skipped on reconnect)
 * 
 * The reconnection state is determined by the TestDriver SDK after connect().
 * 
 * @example
 * import { describe, it, beforeAll, expect } from 'testdriverai/vitest';
 * import TestDriver from 'testdriverai';
 * 
 * describe('My Test', () => {
 *   let testdriver;
 * 
 *   beforeAll(async () => {
 *     testdriver = new TestDriver(process.env.TD_API_KEY);
 *     await testdriver.connect();
 *     
 *     // Store globally so it.once() can access it
 *     globalThis.__testdriver = testdriver;
 *   });
 * 
 *   // Only runs once per sandbox session (skipped on reconnect)
 *   it.once('launch the application', async () => {
 *     await testdriver.exec('sh', 'google-chrome https://example.com', 5000);
 *   });
 * 
 *   // Always runs
 *   it('click the button', async () => {
 *     await testdriver.find('Button').click();
 *   });
 * });
 */

import { afterAll, beforeAll, expect, describe as vitestDescribe, it as vitestIt, test as vitestTest } from 'vitest';

/**
 * Get the TestDriver instance from global state
 * @returns {Object|null} TestDriver instance or null
 */
function getTestDriver() {
  return globalThis.__testdriver || null;
}

/**
 * Check if we're reconnected to an existing sandbox
 * Uses the SDK's isReconnected property set after connect()
 * @returns {boolean} true if reconnected to existing sandbox
 */
function isReconnected() {
  const testdriver = getTestDriver();
  if (!testdriver) {
    // No testdriver yet - assume new sandbox (setup should run)
    return false;
  }
  return testdriver.isReconnected === true;
}

/**
 * Extended test function with .once() modifier
 */
function createExtendedIt(baseIt) {
  const extended = function(name, fn, timeout) {
    return baseIt(name, fn, timeout);
  };
  
  // Copy all properties from base it
  Object.assign(extended, baseIt);
  
  /**
   * it.once() - Only runs once per sandbox session, skipped on reconnect
   * Use for provisioning, app launch, initial navigation
   * 
   * The test checks testdriver.isReconnected which is set by the SDK
   * after connect() based on whether it reconnected to an existing
   * sandbox or created a new one.
   */
  extended.once = function(name, fn, timeout) {
    return baseIt(name, async (...args) => {
      if (isReconnected()) {
        console.log(`⏭️  Skipping (already run in this sandbox): ${name}`);
        return;
      }
      return fn(...args);
    }, timeout);
  };
  
  // Preserve skip, only, todo, etc.
  if (baseIt.skip) extended.skip = baseIt.skip;
  if (baseIt.only) extended.only = baseIt.only;
  if (baseIt.todo) extended.todo = baseIt.todo;
  if (baseIt.concurrent) extended.concurrent = baseIt.concurrent;
  if (baseIt.sequential) extended.sequential = baseIt.sequential;
  
  return extended;
}

// Create extended test functions
export const it = createExtendedIt(vitestIt);
export const test = createExtendedIt(vitestTest);

// Re-export other vitest functions unchanged
export { afterAll, beforeAll, vitestDescribe as describe, expect };

// Also export utility for manual checking
  export { getTestDriver, isReconnected };

