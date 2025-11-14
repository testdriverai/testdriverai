/**
 * TestDriver SDK - Scroll Keyboard Test (Vitest)
 * Converted from: testdriver/acceptance/scroll-keyboard.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestClient, setupTest, teardownTest } from './setup/testHelpers.mjs';

describe('Scroll Keyboard Test', () => {
  let client;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it('should navigate to webhamster.com and scroll with keyboard', async () => {
    // Navigate to https://www.webhamster.com/
    await client.focusApplication('Google Chrome');
    const urlBar = await client.find('testdriver-sandbox.vercel.app/login, the URL in the omnibox showing the current page');
    await urlBar.click();
    await client.pressKeys(['ctrl', 'a']);
    await client.type('https://www.webhamster.com/');
    await client.pressKeys(['enter']);

    // Scroll down with keyboard 1000 pixels
    const heading = await client.find('The Hamster Dance, large heading at top of page');
    await heading.click();
    await client.scroll('down', 1000, 'keyboard');

    // Assert the page is scrolled down
    const result = await client.assert('the page is scrolled down');
    expect(result).toBeTruthy();
  });
});
