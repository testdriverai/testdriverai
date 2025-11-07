#!/usr/bin/env node

/**
 * TestDriver SDK - Exec JS Test
 * Converted from: testdriver/acceptance/exec-js.yaml
 * 
 * Original test: fetch user data from API
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

    // Step 1: fetch user data from API
    console.log('\n💻 Fetching user data from API...');
    const userEmail = await client.exec('js', `
      const response = await fetch('https://jsonplaceholder.typicode.com/users');
      const user = await response.json();
      console.log('user', user[0]);
      result = user[0].email;
    `, 10000);
    console.log('✅ User email fetched:', userEmail);

    // Enter the email in username field
    console.log('\n📝 Entering email in username field...');
    await client.hoverText('Username', 'input field for username', 'click');
    await client.type(userEmail);
    console.log('✅ Email entered');

    // Assert that the username field shows a valid email address
    console.log('\n✔️ Asserting username field contains valid email...');
    await client.assert('the username field contains "Sincere@april.biz" which is a valid email address');
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
