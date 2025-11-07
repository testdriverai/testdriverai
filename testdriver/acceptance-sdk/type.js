#!/usr/bin/env node

/**
 * TestDriver SDK - Type Test
 * Converted from: testdriver/acceptance/type.yaml
 * 
 * Original test: enter standard_user within the username field
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

    // Step 1: enter standard_user within the username field
    console.log('\n📝 Step 1: Entering username...');
    await client.focusApplication('Google Chrome');
    await client.hoverText('Username', 'input field for username', 'click');
    await client.type('standard_user');
    console.log('✅ Username entered');

    // Assert that standard_user shows in the username field
    console.log('\n✔️ Asserting username field contains "standard_user"...');
    await client.assert('the username field contains "standard_user"');
    console.log('✅ Assertion passed!');

    // Step 2: click on sign in
    console.log('\n🖱️ Step 2: Clicking Sign In button...');
    await client.hoverText('Sign in', 'black button below the password field', 'click');
    console.log('✅ Sign In clicked');

    // Assert that "please fill out this field" shows in the password field
    console.log('\n✔️ Asserting validation message appears...');
    await client.focusApplication('Google Chrome');
    await client.assert('Please fill out this field is visible near the password field');
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
