#!/usr/bin/env node

/**
 * TestDriver SDK - Hover Image Test
 * Converted from: testdriver/acceptance/hover-image.yaml
 * 
 * Original test: click on the image of a shopping cart
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
    console.log('\n⚠️  Note: This test requires login to be completed first');

    // Step: click on the image of a shopping cart
    console.log('\n🖱️ Clicking on shopping cart icon...');
    await client.focusApplication('Google Chrome');
    await client.hoverImage('shopping cart icon next to the Cart text in the top right corner', 'click');
    console.log('✅ Shopping cart clicked');

    // Assert that you see an empty shopping cart
    console.log('\n✔️ Asserting empty cart...');
    await client.assert('Your cart is empty');
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
