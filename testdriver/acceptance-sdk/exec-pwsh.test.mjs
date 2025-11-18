/**
 * TestDriver SDK - Exec Shell Test (Vitest)
 * Converted from: testdriver/acceptance/exec-shell.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestClient, setupTest, teardownTest } from './setup/testHelpers.mjs';

const isLinux = process.platform === 'linux';

describe.skipIf(isLinux)('Exec Shell Test', () => {
  let client;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it('should generate random email using PowerShell and enter it', async () => {
    // Generate random email using PowerShell
    const randomEmail = await client.exec('pwsh', `
# Random email generator in PowerShell

# Arrays of possible names and domains
$firstNames = @("john", "jane", "alex", "chris", "sara", "mike", "lisa", "david", "emma", "ryan")
$lastNames = @("smith", "johnson", "williams", "brown", "jones", "garcia", "miller", "davis", "martin", "lee")
$domains = @("example.com", "testmail.com", "mailinator.com", "demo.org", "company.net")

# Random selection
$first = Get-Random -InputObject $firstNames
$last = Get-Random -InputObject $lastNames
$domain = Get-Random -InputObject $domains
$number = Get-Random -Minimum 1 -Maximum 1000

# Generate the email
$email = "$first.$last$number@$domain".ToLower()

# Output
Write-Output "$email"
    `, 10000);

    // Enter the email in username field
    const usernameField = await client.find('Username, input field for username');
    await usernameField.click();
    await client.type(randomEmail);

    // Assert that the username field shows a valid email address
    const result = await client.assert(`the username field contains ${randomEmail} which is a valid email address`);
    expect(result).toBeTruthy();
  });
});
