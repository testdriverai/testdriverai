/**
 * Vitest Setup File for TestDriver
 * 
 * This file is run by Vitest before each test file to set up
 * the TestDriver plugin state and global helpers.
 * 
 * Usage in vitest.config.mjs:
 * ```js
 * export default defineConfig({
 *   test: {
 *     setupFiles: ['testdriverai/vitest/setup'],
 *   },
 * });
 * ```
 */

import {
  clearDashcamUrls,
  clearSuiteTestRun,
  getDashcamUrl,
  getPluginState,
  getSuiteTestRun,
  pluginState,
  registerDashcamUrl,
  setSuiteTestRun,
} from '../../interfaces/vitest-plugin.mjs';

// Set up global TestDriver plugin interface
// This allows tests and the SDK to communicate with the reporter
globalThis.__testdriverPlugin = {
  state: pluginState,
  registerDashcamUrl,
  getDashcamUrl,
  clearDashcamUrls,
  getPluginState,
  getSuiteTestRun,
  setSuiteTestRun,
  clearSuiteTestRun,
};

// Log that setup is complete (only in debug mode)
if (process.env.TD_LOG_LEVEL?.toLowerCase() === 'debug') {
  console.log('[TestDriver] Setup file initialized, global plugin interface available');
}
