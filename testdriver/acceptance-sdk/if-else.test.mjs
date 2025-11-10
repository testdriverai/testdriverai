/**
 * TestDriver SDK - If-Else Test (Vitest)
 * Converted from: testdriver/acceptance/if-else.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { conditionalExec, createTestClient, setupTest, teardownTest } from './setup/testHelpers.mjs';

describe('If-Else Test', () => {
  let client;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it('should handle conditional cookie banner', async () => {
    await client.focusApplication('Google Chrome');
    
    // Check for cookie banner and close if present
    await conditionalExec(
      client,
      'a cookie banner is visible on the page',
      async () => {
        await client.hoverText('Accept Cookies', 'accept cookies button', 'click');
      },
      async () => {
        await client.focusApplication('Google Chrome');
      }
    );
  });

  it('should handle conditional username field', async () => {
    // Check for username field and enter text if present
    await conditionalExec(
      client,
      'the Username field is visible on the page',
      async () => {
        await client.hoverText('Username', 'username field', 'click');
        await client.type('testuser');
      },
      async () => {
        await client.focusApplication('Google Chrome');
      }
    );
    
    // Assert testuser is visible
    const result = await client.assert('the text testuser is visible on screen');
    expect(result).toBeTruthy();
  });
});
