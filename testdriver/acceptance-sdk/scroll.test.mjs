/**
 * TestDriver SDK - Scroll Test (Vitest)
 * Converted from: testdriver/acceptance/scroll.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestClient, setupTest, teardownTest } from './setup/testHelpers.mjs';

describe('Scroll Test', () => {
  let client;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it('should navigate and scroll down the page', async () => {
    // Navigate to webhamster.com
    await client.focusApplication('Google Chrome');
    const urlBar = await client.find('testdriver-sandbox.vercel.app/login, the URL in the omnibox showing the current page');
    await urlBar.click();
    await client.pressKeys(['ctrl', 'a']);
    await client.type('https://www.webhamster.com/');
    await client.pressKeys(['enter']);
    
    // Wait for page to load and click heading
    const heading = await client.find('The Hamster Dance, large heading at top of page');
    await heading.click();
    
    // Scroll down
    await client.scroll('down', 1000);
    
    // Assert page is scrolled
    const result = await client.assert('the page is scrolled down');
    expect(result).toBeTruthy();
  });
});
