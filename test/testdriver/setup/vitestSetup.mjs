/**
 * Vitest Setup File
 * Runs once before all tests in each worker process
 * This ensures the TestDriver plugin global state is available in test processes
 */

// Import the plugin functions
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
} from "../../../interfaces/vitest-plugin.mjs";

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
    "[Vitest Setup] TestDriver plugin API initialized in worker process",
  );
}
