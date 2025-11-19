/**
 * Example Vitest test file demonstrating TestDriver test recording
 * 
 * This example shows how to:
 * 1. Use TestDriver SDK in tests
 * 2. Associate dashcam recordings with tests
 * 3. Record custom test metadata
 * 
 * Run with: npx vitest run examples/test-recording-example.test.js
 */

import { afterAll, beforeAll, describe, test } from 'vitest';
import TestDriverSDK from '../sdk.js';

// Initialize TestDriver client
let client;
let runId;

beforeAll(async () => {
  // Connect to TestDriver
  client = new TestDriverSDK({
    apiKey: process.env.TD_API_KEY || 'your-api-key',
  });
  
  await client.connect();
  
  // Create a test run (usually done by the Vitest reporter, but shown here for demo)
  runId = `example-${Date.now()}`;
  
  const testRun = await client.createTestRun({
    runId,
    suiteName: 'Example Test Suite',
    platform: 'windows',
    git: {
      repo: 'testdriverai/cli',
      branch: 'main',
      commit: 'abc123',
    },
  });
  
  console.log('Test run created:', testRun.runId);
});

afterAll(async () => {
  // Complete the test run
  await client.completeTestRun({
    runId,
    status: 'passed',
    totalTests: 3,
    passedTests: 3,
    failedTests: 0,
  });
  
  await client.disconnect();
});

describe('Login Tests', () => {
  test('should display login page', async () => {
    const testStart = Date.now();
    
    try {
      // Your test logic here
      await client.click('Login');
      
      // Record the test result
      await client.recordTestCase({
        runId,
        testName: 'should display login page',
        testFile: 'examples/test-recording-example.test.js',
        suiteName: 'Login Tests',
        status: 'passed',
        startTime: testStart,
        endTime: Date.now(),
        duration: Date.now() - testStart,
      });
    } catch (error) {
      // Record failure
      await client.recordTestCase({
        runId,
        testName: 'should display login page',
        testFile: 'examples/test-recording-example.test.js',
        status: 'failed',
        errorMessage: error.message,
        errorStack: error.stack,
      });
      throw error;
    }
  });
  
  test('should login with valid credentials', async () => {
    const testStart = Date.now();
    
    try {
      // Test logic
      await client.type('username', 'testuser');
      await client.type('password', 'password123');
      await client.click('Submit');
      
      // Wait for dashboard
      await client.waitForText('Dashboard');
      
      // Record success
      await client.recordTestCase({
        runId,
        testName: 'should login with valid credentials',
        testFile: 'examples/test-recording-example.test.js',
        suiteName: 'Login Tests',
        status: 'passed',
        startTime: testStart,
        endTime: Date.now(),
        duration: Date.now() - testStart,
        // Associate with dashcam replay (if you have the URL)
        replayUrl: process.env.DASHCAM_REPLAY_URL,
      });
    } catch (error) {
      await client.recordTestCase({
        runId,
        testName: 'should login with valid credentials',
        testFile: 'examples/test-recording-example.test.js',
        status: 'failed',
        errorMessage: error.message,
        errorStack: error.stack,
      });
      throw error;
    }
  });
  
  test('should show error with invalid credentials', async () => {
    const testStart = Date.now();
    
    try {
      await client.type('username', 'wrong');
      await client.type('password', 'wrong');
      await client.click('Submit');
      
      await client.waitForText('Invalid credentials');
      
      await client.recordTestCase({
        runId,
        testName: 'should show error with invalid credentials',
        testFile: 'examples/test-recording-example.test.js',
        suiteName: 'Login Tests',
        status: 'passed',
        startTime: testStart,
        endTime: Date.now(),
        duration: Date.now() - testStart,
        steps: [
          { action: 'type', target: 'username', value: 'wrong' },
          { action: 'type', target: 'password', value: 'wrong' },
          { action: 'click', target: 'Submit' },
          { action: 'waitForText', target: 'Invalid credentials' },
        ],
      });
    } catch (error) {
      await client.recordTestCase({
        runId,
        testName: 'should show error with invalid credentials',
        testFile: 'examples/test-recording-example.test.js',
        status: 'failed',
        errorMessage: error.message,
        errorStack: error.stack,
      });
      throw error;
    }
  });
});
