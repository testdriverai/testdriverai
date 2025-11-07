/**
 * TestDriver SDK - Match Image Test (Vitest)
 * Converted from: testdriver/acceptance/match-image.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestClient, performLogin, setupTest, teardownTest } from './setup/testHelpers.mjs';

describe('Match Image Test', () => {
  let client;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it.skip('should match shopping cart image and verify empty cart', async () => {
    // Perform login first
    await performLogin(client);

    // Note: matchImage requires an image path which is not provided
    // This test is skipped until image path is available
    // await client.matchImage('path/to/cart-icon.png', 'click');

    // Assert that you see an empty shopping cart
    const result = await client.assert('Your cart is empty');
    expect(result).toBeTruthy();
  });
});
