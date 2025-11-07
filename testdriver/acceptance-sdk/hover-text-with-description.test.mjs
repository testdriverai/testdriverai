/**
 * TestDriver SDK - Hover Text With Description Test (Vitest)
 * Converted from: testdriver/acceptance/hover-text-with-description.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestClient, performLogin, setupTest, teardownTest } from './setup/testHelpers.mjs';

describe('Hover Text With Description Test', () => {
  let client;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it('should add TestDriver Hat to cart and verify', async () => {
    // Perform login first
    await performLogin(client);

    // Click on "Add to Cart" under TestDriver Hat
    await client.focusApplication('Google Chrome');
    await client.hoverText('Add to Cart', 'add to cart button under TestDriver Hat', 'click');

    // Click on the cart
    await client.focusApplication('Google Chrome');
    await client.hoverText('Cart', 'cart button in the top right corner', 'click');

    // Assert the TestDriver Hat is in the cart
    await client.focusApplication('Google Chrome');
    const result = await client.assert('TestDriver Hat is in the cart');
    expect(result).toBeTruthy();
  });
});
