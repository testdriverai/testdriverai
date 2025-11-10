#!/usr/bin/env node

/**
 * TestDriver SDK - Hover Text With Description Test
 * Converted from: testdriver/acceptance/hover-text-with-description.yaml
 * 
 * Original test: click on add to cart under the testdriver hat
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

    // Step 1: click on add to cart under the testdriver hat
    console.log('\n🖱️ Clicking "Add to Cart" under TestDriver Hat...');
    await client.focusApplication('Google Chrome');
    await client.hoverText('Add to Cart', 'add to cart button under TestDriver Hat', 'click');
    console.log('✅ Added to cart');

    // Step 2: click on the cart
    console.log('\n🛒 Clicking cart button...');
    await client.focusApplication('Google Chrome');
    await client.hoverText('Cart', 'cart button in the top right corner', 'click');
    console.log('✅ Cart opened');

    // Assert the testdriver hat is in the cart
    console.log('\n✔️ Asserting TestDriver Hat is in the cart...');
    await client.focusApplication('Google Chrome');
    await client.assert('TestDriver Hat is in the cart');
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
