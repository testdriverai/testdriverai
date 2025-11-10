#!/usr/bin/env node

/**
 * Example: SDK with Browser Rendering
 * 
 * This example demonstrates how the SDK automatically opens a browser window
 * to show the live sandbox environment, just like the CLI does.
 * 
 * Run with:
 *   TD_API_KEY=your_key node examples/sdk-with-browser.js
 */

const TestDriver = require('../sdk.js');

async function runTestWithBrowser() {
  console.log('🚀 Starting TestDriver SDK with browser rendering...\n');

  // Create client with logging enabled to see the browser URL
  const client = new TestDriver(process.env.TD_API_KEY, {
    logging: true
  });

  try {
    console.log('🔐 Authenticating...');
    await client.auth();

    console.log('🔌 Connecting to sandbox...');
    console.log('   (A browser window should open automatically)\n');
    
    // Connect without headless mode (default)
    // This will automatically open a browser window
    await client.connect({ newSandbox: true });

    console.log('\n✅ Sandbox is ready!');
    console.log('👀 You should see the sandbox in your browser\n');

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
    console.log('💡 The browser window will remain open until you close it or disconnect\n');

    // Keep the sandbox running for a bit to see the results
    console.log('⏳ Keeping sandbox open for 10 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  } finally {
    console.log('🧹 Disconnecting...');
    await client.disconnect();
    console.log('✅ Done!\n');
  }
}

// Run the test
runTestWithBrowser().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
