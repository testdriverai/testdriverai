/**
 * TestDriver SDK - Match Image Test (Vitest)
 * Converted from: testdriver/acceptance/match-image.yaml
 */

import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestClient, performLogin, setupTest, teardownTest } from './setup/testHelpers.mjs';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Match Image Test', () => {
  let client;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it('should match shopping cart image and verify empty cart', async () => {
    // Perform login first
    await performLogin(client);

    // Match and click the shopping cart icon
    const cartImagePath = path.resolve(__dirname, '../../_testdriver/acceptance/screenshots/cart.png');
    await client.matchImage(cartImagePath, 'click');

    // Assert that you see an empty shopping cart
    const result = await client.assert('Your cart is empty');
    expect(result).toBeTruthy();
  });
});
