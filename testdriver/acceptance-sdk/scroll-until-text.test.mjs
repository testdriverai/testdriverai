/**
 * TestDriver SDK - Scroll Until Text Test (Vitest)
 * Converted from: testdriver/acceptance/scroll-until-text.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestClient, performLogin, setupTest, teardownTest } from './setup/testHelpers.mjs';

describe('Scroll Until Text Test', () => {
  let client;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it('should scroll until "testdriver socks" appears', async () => {
    // Perform login first
    await performLogin(client);
    
    // Scroll until text appears
    await client.focusApplication('Google Chrome');
    await client.scrollUntilText('testdriver socks', 'down');

    // Assert testdriver socks appears on screen
    await client.focusApplication('Google Chrome');
    const result = await client.assert('TestDriver Socks appears on screen');
    expect(result).toBeTruthy();
  });
});
