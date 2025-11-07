#!/usr/bin/env node

/**
 * TestDriver SDK - Scroll Keyboard Test
 * Converted from: testdriver/acceptance/scroll-keyboard.yaml
 * 
 * Original test: Navigate to https://www.webhamster.com/ and scroll with keyboard
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

    // Step 1: Navigate to https://www.webhamster.com/
    console.log('\n🌐 Navigating to webhamster.com...');
    await client.focusApplication('Google Chrome');
    await client.hoverText('testdriver-sandbox.vercel.app/login', 'the URL in the omnibox showing the current page', 'click');
    await client.pressKeys(['ctrl', 'a']);
    await client.type('https://www.webhamster.com/');
    await client.pressKeys(['enter']);
    console.log('✅ Navigation complete');

    // Step 2: scroll down with keyboard 1000 pixels
    console.log('\n⌨️ Scrolling down 1000 pixels with keyboard...');
    await client.hoverText('The Hamster Dance', 'large heading at top of page', 'click');
    await client.scroll('down', 1000, 'keyboard');
    console.log('✅ Scrolled down');

    // Assert the "The Hamster Dance" heading does not show on the webpage
    console.log('\n✔️ Asserting page is scrolled down...');
    await client.assert('the page is scrolled down');
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
