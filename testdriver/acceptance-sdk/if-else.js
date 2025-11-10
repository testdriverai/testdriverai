#!/usr/bin/env node

/**
 * TestDriver SDK - If-Else Test
 * Converted from: testdriver/acceptance/if-else.yaml
 * 
 * Original test: if a cookie banner is present on the page, close it
 * 
 * Note: The SDK doesn't have a built-in if-else command like the YAML format.
 * This implementation uses try-catch to handle conditional logic.
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

    await client.focusApplication('Google Chrome');

    // Step 1: if a cookie banner is visible on the page, close it
    console.log('\n🍪 Checking for cookie banner...');
    try {
      // Try to assert the cookie banner exists with a short timeout
      await client.assert('a cookie banner is visible on the page');
      console.log('✅ Cookie banner found, accepting cookies...');
      await client.hoverText('Accept Cookies', 'accept cookies button', 'click');
    } catch {
      console.log('ℹ️  No cookie banner found, continuing...');
      await client.focusApplication('Google Chrome');
    }

    // Step 2: if the Username field is visible on the page, enter testuser
    console.log('\n👤 Checking for Username field...');
    try {
      // Try to assert the Username field exists with a short timeout
      await client.assert('the Username field is visible on the page');
      console.log('✅ Username field found, entering testuser...');
      await client.hoverText('Username', 'username field', 'click');
      await client.type('testuser');
    } catch {
      console.log('ℹ️  No Username field found, continuing...');
      await client.focusApplication('Google Chrome');
    }

    // Assert the text testuser is visible on screen
    console.log('\n✔️ Asserting testuser is visible...');
    await client.assert('the text testuser is visible on screen');
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
