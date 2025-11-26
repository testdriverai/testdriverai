/**
 * TestDriver SDK - Exec Shell Test (Vitest)
 * Converted from: testdriver/acceptance/exec-shell.yaml
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../../src/vitest/hooks.mjs";

describe("Exec PowerShell Test", () => {
  it.skipIf(process.env.TD_OS === "linux")(
    "should generate random email using PowerShell and enter it",
    async (context) => {
      const testdriver = TestDriver(context, { headless: true });
      await testdriver.provision.chrome({ url: 'http://testdriver-sandbox.vercel.app/login' });

      //
      // Generate random email using PowerShell
      const randomEmail = await testdriver.exec(
        "pwsh",
        `
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
    `,
        10000,
      );

      // Enter the email in username field
      const usernameField = await testdriver.find(
        "Username, input field for username",
      );
      await usernameField.click();
      await testdriver.type(randomEmail);

      // Assert that the username field shows a valid email address
      const result = await testdriver.assert(
        `the username field contains ${randomEmail} which is a valid email address`,
      );
      expect(result).toBeTruthy();
    },
  );
});
