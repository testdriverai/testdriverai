#!/usr/bin/env node

/**
 * TestDriver SDK - Focus Window Test
 * Converted from: testdriver/acceptance/focus-window.yaml
 * 
 * Original test: click on the microsoft edge icon and focus google chrome
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

    // Step 1: click on the microsoft edge icon
    console.log('\n🖱️ Clicking Microsoft Edge icon...');
    await client.pressKeys(['winleft', 'd']);
    await client.hoverImage('a blue and green swirl icon on the taskbar representing Microsoft Edge', 'click');
    console.log('✅ Microsoft Edge clicked');

    // Step 2: focus google chrome
    console.log('\n🌐 Focusing Google Chrome...');
    await client.focusApplication('Google Chrome');
    console.log('✅ Google Chrome focused');

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
