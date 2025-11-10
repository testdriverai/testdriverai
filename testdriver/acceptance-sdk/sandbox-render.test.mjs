/**
 * Test: Sandbox Rendering with Browser Window
 * 
 * This test verifies that the SDK can open the sandbox in a browser window,
 * similar to how the agent CLI does it.
 * 
 * Run with:
 *   TD_API_KEY=your_key npx vitest run testdriver/acceptance-sdk/sandbox-render.test.mjs
 * 
 * Or with logging:
 *   TD_API_KEY=your_key VERBOSE=true npx vitest run testdriver/acceptance-sdk/sandbox-render.test.mjs
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestClient, setupTest, teardownTest } from './setup/testHelpers.mjs';

describe('Sandbox Rendering', () => {
  let client;

  beforeAll(async () => {
    console.log('📋 Setting up test with sandbox rendering...\n');
    
    // Create client with logging enabled
    client = createTestClient({ 
      logging: true
    });

    // Set up event listener to verify showWindow event is emitted
    let showWindowEmitted = false;
    const emitter = client.getEmitter();
    
    emitter.on('show-window', (url) => {
      showWindowEmitted = true;
      console.log('✅ showWindow event emitted with URL:', url);
    });

    await setupTest(client);

    // Give it a moment for the event to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify the event was emitted
    expect(showWindowEmitted).toBe(true);
  }, 180000); // 3 minute timeout for sandbox creation

  afterAll(async () => {
    console.log('\n🧹 Cleaning up...');
    await teardownTest(client);
    console.log('✅ Cleanup complete\n');
  });

  it('should have opened the sandbox in a browser window', async () => {
    // The sandbox should be visible at this point
    // Let's verify by checking if we can interact with it
    await client.focusApplication('Google Chrome');
    
    const result = await client.assert('the TestDriver.ai Sandbox is visible');
    expect(result).toBeTruthy();
  });

  it('should allow interaction with the sandbox UI', async () => {
    // Interact with the login page
    await client.hoverText('Username', 'username input field', 'click');
    await client.type('test_user');
    
    const result = await client.assert('text has been entered in the username field');
    expect(result).toBeTruthy();
  });
});
