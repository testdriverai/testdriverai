/**
 * TestDriver SDK - Hover Text Test (Vitest)
 * Converted from: testdriver/acceptance/hover-text.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestClient, setupTest, teardownTest } from './setup/testHelpers.mjs';

describe('Hover Text Test', () => {
  let client;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it('should click Sign In and verify error message', async () => {
    // Click on Sign In button using new find() API
    await client.focusApplication('Google Chrome');
    
    const signInButton = await client.find('Sign In, black button below the password field');
    await signInButton.click();

    // Assert that an error shows that fields are required
    const result = await client.assert('an error shows that fields are required');
    expect(result).toBeTruthy();
  });
});
