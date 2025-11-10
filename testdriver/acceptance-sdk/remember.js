#!/usr/bin/env node

/**
 * TestDriver SDK - Remember Test
 * Converted from: testdriver/acceptance/remember.yaml
 * 
 * Original test: focus chrome, remember the password, enter the username and the remembered password and login
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

    // Step: focus chrome, remember the password, enter the username and the remembered password and login
    console.log('\n🧠 Remembering the password...');
    const myPassword = await client.remember('the password');
    console.log('✅ Password remembered:', myPassword);

    console.log('\n📝 Entering username...');
    await client.hoverText('Username', 'username input field', 'click');
    await client.type('standard_user');
    console.log('✅ Username entered');

    console.log('\n📝 Entering password...');
    await client.pressKeys(['tab']);
    await client.type(myPassword);
    console.log('✅ Password entered');

    console.log('\n🖱️ Submitting login form...');
    await client.pressKeys(['tab']);
    await client.pressKeys(['enter']);
    console.log('✅ Form submitted');

    // Assert The product listing page is visible
    console.log('\n✔️ Asserting product listing page is visible...');
    await client.assert('The product listing page is visible');
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
