/**
 * TestDriver SDK - Remember Test (Vitest)
 * Converted from: testdriver/acceptance/remember.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestClient, performLogin, setupTest, teardownTest } from './setup/testHelpers.mjs';

describe('Remember Test', () => {
  let client;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it('should remember password and complete login', async () => {
    // Remember the password
    const password = await client.remember('the password');
    expect(password).toBeTruthy();
    expect(typeof password).toBe('string');
    
    // Perform login using remembered password
    await performLogin(client, 'standard_user', password);
    
    // Assert product listing page is visible
    const result = await client.assert('The product listing page is visible');
    expect(result).toBeTruthy();
  });
});
