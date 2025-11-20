/**
 * Shared Test State Module
 * 
 * This module uses Node.js module caching to share state between
 * the reporter process and worker processes in Vitest.
 * 
 * Since Node.js caches modules, all imports of this file will
 * receive the same state object instance.
 */

// Shared state object that persists across all imports
const sharedState = {
  testRun: null,
  testRunId: null,
  token: null,
  apiKey: null,
  apiRoot: null,
  startTime: null,
};

/**
 * Set the test run information
 */
export function setTestRunInfo(info) {
  console.log('[SharedState] Setting test run info:', { 
    testRunId: info.testRunId,
    hasToken: !!info.token,
    hasTestRun: !!info.testRun
  });
  
  if (info.testRun) sharedState.testRun = info.testRun;
  if (info.testRunId) sharedState.testRunId = info.testRunId;
  if (info.token) sharedState.token = info.token;
  if (info.apiKey) sharedState.apiKey = info.apiKey;
  if (info.apiRoot) sharedState.apiRoot = info.apiRoot;
  if (info.startTime) sharedState.startTime = info.startTime;
}

/**
 * Get the test run information
 */
export function getTestRunInfo() {
  return {
    testRun: sharedState.testRun,
    testRunId: sharedState.testRunId,
    token: sharedState.token,
    apiKey: sharedState.apiKey,
    apiRoot: sharedState.apiRoot,
    startTime: sharedState.startTime,
  };
}

/**
 * Clear the test run information
 */
export function clearTestRunInfo() {
  console.log('[SharedState] Clearing test run info');
  sharedState.testRun = null;
  sharedState.testRunId = null;
  sharedState.token = null;
  sharedState.startTime = null;
}

/**
 * Direct access to state (for debugging)
 */
export function getState() {
  return sharedState;
}
