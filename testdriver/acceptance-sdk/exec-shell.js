#!/usr/bin/env node

/**
 * TestDriver SDK - Exec Shell Test
 * Converted from: testdriver/acceptance/exec-shell.yaml
 * 
 * Original test: Generate random email using PowerShell
 */

const TestDriver = require('../../sdk');

async function main() {
  const client = new TestDriver(process.env.TD_API_KEY, {
    resolution: '1366x768',
    analytics: true,
    logging: true
  });

  try {
    console.log('🔐 Authenticating...');
    await client.auth();

    console.log('🔌 Connecting to sandbox...');
    await client.connect({ newSandbox: true });
    console.log('✅ Connected!');

    // Step 1: Generate random email using PowerShell
    console.log('\n💻 Generating random email with PowerShell...');
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
    console.log('✅ Random email generated:', randomEmail);

    // Enter the email in username field
    console.log('\n📝 Entering email in username field...');
    await client.hoverText('Username', 'input field for username', 'click');
    await client.type(randomEmail);
    console.log('✅ Email entered');

    // Assert that the username field shows a valid email address
    console.log('\n✔️ Asserting username field contains valid email...');
    await client.assert(`the username field contains ${randomEmail} which is a valid email address`);
    console.log('✅ Assertion passed!');

    console.log('\n🎉 Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    console.log('\n🧹 Disconnecting...');
    await client.disconnect();
    console.log('👋 Done!');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
