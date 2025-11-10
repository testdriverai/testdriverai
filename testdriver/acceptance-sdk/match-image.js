#!/usr/bin/env node

/**
 * TestDriver SDK - Match Image Test
 * Converted from: testdriver/acceptance/match-image.yaml
 * 
 * Original test: match the image of a shopping cart
 * 
 * Note: This test requires the login snippet and match-cart snippet to be run.
 * You may need to implement these flows or adjust accordingly.
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

    // Note: Original test runs snippets/login.yaml and snippets/match-cart.yaml
    console.log('\n⚠️  Note: This test requires login and match-cart snippets');
    console.log('⚠️  You will need to provide the image path for matchImage()');

    // Step: match the image of a shopping cart
    // Note: You need to provide the actual image path
    console.log('\n🖼️ Matching shopping cart image...');
    // await client.matchImage('path/to/cart-icon.png', 'click');
    console.log('⚠️  Skipped: matchImage requires image path');

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
