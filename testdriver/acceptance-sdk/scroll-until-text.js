#!/usr/bin/env node

/**
 * TestDriver SDK - Scroll Until Text Test
 * Converted from: testdriver/acceptance/scroll-until-text.yaml
 * 
 * Original test: scroll until text testdriver socks
 * 
 * Note: This test requires the login snippet to be run first.
 * You may need to implement the login flow or adjust accordingly.
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

    // Note: Original test runs snippets/login.yaml first
    // You may need to implement login here or adjust test accordingly
    console.log('\n⚠️  Note: This test requires login to be completed first');
    
    // Step: scroll until text testdriver socks
    console.log('\n📜 Scrolling until "testdriver socks" appears...');
    await client.focusApplication('Google Chrome');
    await client.scrollUntilText('testdriver socks', 'down');
    console.log('✅ Found "testdriver socks"');

    // Assert testdriver socks appears on screen
    console.log('\n✔️ Asserting TestDriver Socks appears on screen...');
    await client.focusApplication('Google Chrome');
    await client.assert('TestDriver Socks appears on screen');
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
