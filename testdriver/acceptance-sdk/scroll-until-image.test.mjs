/**
 * TestDriver SDK - Scroll Until Image Test (Vitest)
 * Converted from: testdriver/acceptance/scroll-until-image.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestClient, setupTest, teardownTest } from './setup/testHelpers.mjs';

describe('Scroll Until Image Test', () => {
  let client;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it('should scroll until brown colored house image appears', async () => {
    // Navigate to Wikipedia page
    await client.pressKeys(['ctrl', 'l']);
    await client.type('https://en.wikipedia.org/wiki/Leonardo_da_Vinci');
    await client.pressKeys(['enter']);

    // Click on heading
    const heading = await client.find('Leonardo Da Vinci, the page heazding');
    await heading.click();
    
    // Scroll until image appears
    await client.scrollUntilImage('a brown colored house', 'down', 10000);

    // Assert image of brown colored house appears on screen
    const result = await client.assert('image of brown colored house appears on screen');
    expect(result).toBeTruthy();
  });
});
