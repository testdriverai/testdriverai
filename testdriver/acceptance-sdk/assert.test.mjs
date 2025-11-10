/**
 * TestDriver SDK - Assert Test (Vitest)
 * Converted from: testdriver/acceptance/assert.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestClient, setupTest, teardownTest } from './setup/testHelpers.mjs';

describe('Assert Test', () => {
  let client;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it('should assert the testdriver login page shows', async () => {
    // Assert the TestDriver.ai Sandbox login page is displayed
    const result = await client.assert('the TestDriver.ai Sandbox login page is displayed');
    
    expect(result).toBeTruthy();
  });
});
