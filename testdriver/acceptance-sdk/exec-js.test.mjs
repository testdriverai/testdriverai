/**
 * TestDriver SDK - Exec JS Test (Vitest)
 * Converted from: testdriver/acceptance/exec-js.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestClient, setupTest, teardownTest } from './setup/testHelpers.mjs';

describe('Exec JS Test', () => {
  let client;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it('should fetch user data from API and enter email', async () => {
    // Execute JavaScript to fetch user data
    const userEmail = await client.exec('js', `
      const response = await fetch('https://jsonplaceholder.typicode.com/users');
      const user = await response.json();
      console.log('user', user[0]);
      result = user[0].email;
    `, 10000);
    
    expect(userEmail).toBeTruthy();
    expect(userEmail).toContain('@');
    
    // Enter email in username field
    const usernameField = await client.find('Username, input field for username');
    await usernameField.click();
    await client.type(userEmail);
    
    // Assert email is in the field
    const result = await client.assert('the username field contains "Sincere@april.biz" which is a valid email address');
    expect(result).toBeTruthy();
  });
});
