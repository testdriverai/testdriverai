/**
 * Example: Running a test with logging enabled
 * 
 * This demonstrates how to see detailed logs during test execution.
 * 
 * Run with:
 *   VERBOSE=true npx vitest run testdriver/acceptance-sdk/example-with-logging.test.mjs
 * 
 * Or with debug events:
 *   DEBUG_EVENTS=true VERBOSE=true npx vitest run testdriver/acceptance-sdk/example-with-logging.test.mjs
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestClient, setupTest, teardownTest } from './setup/testHelpers.mjs';

describe('Example Test with Logging', () => {
  let client;

  beforeAll(async () => {
    console.log('📋 Setting up test with logging enabled...\n');
    
    // Create client with logging enabled
    client = createTestClient({ 
      logging: true  // Force logging on for this test
    });

    // Optional: Set up detailed event logging
    // Uncomment to see all events:
    // setupEventLogging(client);

    // Or add custom event listeners:
    const emitter = client.getEmitter();
    
    emitter.on('command:start', (data) => {
      console.log('\n🚀 Starting command:', data?.command || 'unknown');
    });

    emitter.on('command:success', () => {
      console.log('✅ Command completed successfully\n');
    });

    emitter.on('sandbox:connected', () => {
      console.log('🔌 Sandbox connection established\n');
    });

    await setupTest(client);
  });

  afterAll(async () => {
    console.log('\n🧹 Cleaning up...');
    await teardownTest(client);
    console.log('✅ Cleanup complete\n');
  });

  it('should demonstrate logging during test execution', async () => {
    console.log('\n📝 Test: Checking if login page is visible...');
    
    // This will show markdown-formatted AI responses if VERBOSE=true
    const result = await client.assert('the TestDriver.ai Sandbox login page is displayed');
    
    console.log('📊 Assertion result:', result);
    expect(result).toBeTruthy();
  });

  it('should show logs for hover and type operations', async () => {
    console.log('\n📝 Test: Interacting with username field...');
    
    await client.focusApplication('Google Chrome');
    console.log('  ✓ Focused Chrome');
    
    const usernameField = await client.find('Username, username input field');
    await usernameField.click();
    console.log('  ✓ Clicked username field');
    
    await client.type('test_user');
    console.log('  ✓ Typed username');
    
    const result = await client.assert('the username field contains text');
    expect(result).toBeTruthy();
  });
});
