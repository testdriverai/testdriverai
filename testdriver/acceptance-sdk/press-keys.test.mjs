/**
 * TestDriver SDK - Press Keys Test (Vitest)
 * Converted from: testdriver/acceptance/press-keys.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestClient, setupTest, teardownTest } from './setup/testHelpers.mjs';

describe('Press Keys Test', () => {
  let client;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it('should create tabs and navigate using keyboard shortcuts', async () => {
    await client.focusApplication('Google Chrome');
    await client.hoverText('Sign In', 'black button below the password field', 'click');
    
    // Open new tab
    await client.pressKeys(['ctrl', 't']);
    await client.waitForText('Learn more');
    
    // Open DevTools
    await client.pressKeys(['ctrl', 'shift', 'i']);
    await client.waitForText('Elements');
    
    // Open another tab and navigate
    await client.pressKeys(['ctrl', 't']);
    await client.type('google.com');
    await client.pressKeys(['enter']);
    
    // Assert Google appears
    const result = await client.assert('google appears');
    expect(result).toBeTruthy();
  });
});
