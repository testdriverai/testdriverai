/**
 * TypeScript definitions for TestDriver Vitest Plugin
 * @module testdriverai/vitest/plugin
 */

import TestDriverSDK, { TestDriverOptions } from '../sdk';

/**
 * Plugin state object
 */
export interface PluginState {
  dashcamUrls: Map<string, { url: string; platform: string }>;
  suiteTestRuns: Map<string, any>;
  testDriverOptions: TestDriverOptions;
}

/**
 * Current plugin state
 */
export const pluginState: PluginState;

/**
 * Register a Dashcam URL for a test
 */
export function registerDashcamUrl(testId: string, url: string, platform: string): void;

/**
 * Get Dashcam URL for a test
 */
export function getDashcamUrl(testId: string): { url: string; platform: string } | undefined;

/**
 * Clear all Dashcam URLs
 */
export function clearDashcamUrls(): void;

/**
 * Get suite test run data
 */
export function getSuiteTestRun(suiteId: string): any;

/**
 * Set suite test run data
 */
export function setSuiteTestRun(suiteId: string, runData: any): void;

/**
 * Clear suite test run data
 */
export function clearSuiteTestRun(suiteId: string): void;

/**
 * Get the current plugin state
 */
export function getPluginState(): PluginState;

/**
 * Authenticate with API key
 */
export function authenticateWithApiKey(apiKey: string, apiRoot?: string): Promise<string>;

/**
 * Create a test run directly via API
 */
export function createTestRunDirect(token: string, apiRoot: string, testRunData: any): Promise<any>;

/**
 * Record a test case directly via API
 */
export function recordTestCaseDirect(token: string, apiRoot: string, testCaseData: any): Promise<any>;

/**
 * Create a TestDriver instance
 */
export function createTestDriver(options?: TestDriverOptions): Promise<TestDriverSDK>;

/**
 * Register a test with TestDriver
 */
export function registerTest(testdriver: TestDriverSDK, context: any): void;

/**
 * Cleanup a TestDriver instance
 */
export function cleanupTestDriver(testdriver: TestDriverSDK): Promise<void>;

/**
 * Plugin options
 */
export interface TestDriverPluginOptions extends TestDriverOptions {
  /**
   * API key (defaults to TD_API_KEY env var)
   */
  apiKey?: string;
}

/**
 * TestDriver Vitest Plugin
 * @param options - Plugin configuration options
 */
export default function testDriverPlugin(options?: TestDriverPluginOptions): any;
