/**
 * Vitest Setup File for TestDriver
 * 
 * Add this to your vitest.config.js setupFiles to initialize
 * the TestDriver plugin in worker processes.
 * 
 * @example
 * // vitest.config.js
 * import { defineConfig } from "vitest/config";
 * import testDriverPlugin from "testdriverai/vitest/plugin";
 * 
 * export default defineConfig({
 *   plugins: [testDriverPlugin({ apiKey: process.env.TD_API_KEY })],
 *   test: {
 *     setupFiles: ["testdriverai/vitest/setup"],
 *   },
 * });
 */

import {
  authenticateWithApiKey,
  clearDashcamUrls,
  clearSuiteTestRun,
  createTestRunDirect,
  getDashcamUrl,
  getPluginState,
  getSuiteTestRun,
  pluginState,
  recordTestCaseDirect,
  registerDashcamUrl,
  setSuiteTestRun,
} from "../../interfaces/vitest-plugin.mjs";

// Make the plugin API available globally in the test worker process
if (typeof globalThis !== "undefined") {
  globalThis.__testdriverPlugin = {
    registerDashcamUrl,
    getDashcamUrl,
    clearDashcamUrls,
    authenticateWithApiKey,
    createTestRunDirect,
    recordTestCaseDirect,
    getSuiteTestRun,
    setSuiteTestRun,
    clearSuiteTestRun,
    getPluginState,
    state: pluginState,
  };
  console.log(
    "[TestDriver] Plugin API initialized in worker process",
  );
}
