/**
 * TestDriver SDK - Embed Test (Vitest)
 * Converted from: testdriver/acceptance/embed.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestClient, performLogin, setupTest, teardownTest } from './setup/testHelpers.mjs';

describe('Embed Test', () => {
  let client;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it('should run login test and assert home page appears', async () => {
    // Run login snippet (using helper function)
    await performLogin(client);

    // Assert home page appears
    const result = await client.assert('home page appears');
    expect(result).toBeTruthy();
  });
});
