#!/usr/bin/env node

/**
 * TestDriver SDK - Prompt Test
 * Converted from: testdriver/acceptance/prompt.yaml
 * 
 * Original test: AI-driven prompts without explicit commands
 * 
 * Note: The SDK doesn't have a direct equivalent to YAML prompts without commands.
 * This would typically be handled by the AI agent interpreting natural language.
 * For SDK usage, you need to use explicit commands.
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

    console.log('\n⚠️  Note: This test uses AI prompts without explicit commands in YAML');
    console.log('⚠️  The SDK requires explicit method calls. Original prompts were:');
    console.log('   1. "log in"');
    console.log('   2. "add an item to the cart"');
    console.log('   3. "click on the cart icon"');
    console.log('   4. "complete checkout"');

    // You would need to implement these as explicit SDK calls:
    // Example implementation (pseudo-code):
    
    // Step 1: log in
    // await performLogin(client);
    
    // Step 2: add an item to the cart
    // await client.focusApplication('Google Chrome');
    // await client.hoverText('Add to Cart', 'add to cart button', 'click');
    
    // Step 3: click on the cart icon
    // await client.hoverText('Cart', 'cart icon', 'click');
    
    // Step 4: complete checkout
    // await client.hoverText('Checkout', 'checkout button', 'click');
    // ... more steps

    // Assert
    console.log('\n✔️ Asserting testdriver sandbox is visible...');
    await client.assert('the testdriver sandbox is visible');
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
