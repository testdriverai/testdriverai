#!/usr/bin/env node

/**
 * Example: SDK in Headless Mode
 * 
 * This example demonstrates how to run the SDK without opening a browser window,
 * useful for CI/CD environments or automated testing scenarios.
 * 
 * Run with:
 *   TD_API_KEY=your_key node examples/sdk-headless.js
 */

const TestDriver = require('../sdk.js');

async function runHeadlessTest() {
  console.log('🚀 Starting TestDriver SDK in headless mode...\n');

  // Create client with logging enabled
  const client = new TestDriver(process.env.TD_API_KEY, {
    logging: true
  });

  try {
    console.log('🔐 Authenticating...');
    await client.auth();

    console.log('🔌 Connecting to sandbox in headless mode...');
    console.log('   (No browser window will open)\n');
    
    // Connect with headless mode enabled
    await client.connect({ 
      newSandbox: true,
      headless: true  // Disable browser window
    });

    console.log('✅ Sandbox is ready!');
    console.log('🤖 Running in headless mode - no browser window\n');

    // Run some basic commands
    console.log('📝 Running test commands...\n');

    await client.focusApplication('Google Chrome');
    console.log('  ✓ Focused Chrome');

    await client.assert('the TestDriver.ai Sandbox login page is displayed');
    console.log('  ✓ Verified login page');

    await client.hoverText('Username', 'username input field', 'click');
    console.log('  ✓ Clicked username field');

    await client.type('demo_user');
    console.log('  ✓ Typed username');

    await client.hoverText('Password', 'password input field', 'click');
    console.log('  ✓ Clicked password field');

    await client.type('demo_password');
    console.log('  ✓ Typed password');

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  } finally {
    console.log('\n🧹 Disconnecting...');
    await client.disconnect();
    console.log('✅ Done!\n');
  }
}

// Run the test
runHeadlessTest().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
