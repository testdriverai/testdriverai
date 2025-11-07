/**
 * TestDriver SDK - Focus Window Test (Vitest)
 * Converted from: testdriver/acceptance/focus-window.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestClient, setupTest, teardownTest } from './setup/testHelpers.mjs';

describe('Focus Window Test', () => {
  let client;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it('should click Microsoft Edge icon and focus Google Chrome', async () => {
    // Show desktop
    await client.pressKeys(['winleft', 'd']);
    
    // Click on the Microsoft Edge icon
    await client.hoverImage('a blue and green swirl icon on the taskbar representing Microsoft Edge', 'click');

    // Focus Google Chrome
    await client.focusApplication('Google Chrome');

    // Assert Chrome is focused (implicit through successful focus)
    const result = await client.assert('Google Chrome is the focused application');
    expect(result).toBeTruthy();
  });
});
