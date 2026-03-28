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

import { isMainThread } from 'node:worker_threads';

// Detect incompatible pool configuration at the earliest possible point.
// TestDriver requires pool: "forks" because each test needs its own process for:
// - Independent process.env per sandbox (IPs, tokens, session IDs)
// - Safe child process management (AWS instances, shell commands)
// - Independent signal handlers (SIGINT/SIGTERM cleanup)
if (!isMainThread) {
  throw new Error(
    '\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
    '  TestDriver: Incompatible Vitest pool configuration\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
    '  You are using pool: "threads" (or "vmThreads"), which runs\n' +
    '  tests in worker threads sharing a single process. TestDriver\n' +
    '  requires pool: "forks" for full process isolation.\n\n' +
    '  Fix your vitest.config.mjs:\n\n' +
    '    export default defineConfig({\n' +
    '      test: {\n' +
    '        pool: "forks",  // Required for TestDriver\n' +
    '        maxWorkers: 16, // Match your license slots & CPU cores\n' +
    '        // ...\n' +
    '      },\n' +
    '    });\n\n' +
    '  Or simply remove the pool option ("forks" is the Vitest default).\n\n' +
    '  For more concurrency, use a larger GitHub Actions runner with\n' +
    '  more CPU cores. See: https://testdriver.ai/docs/v7/concurrency\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
  );
}

import {
    clearDashcamUrls,
    clearSuiteTestRun,
    getAllDashcamUrls,
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
  getAllDashcamUrls,
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
