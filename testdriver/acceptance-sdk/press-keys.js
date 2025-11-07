#!/usr/bin/env node

/**
 * TestDriver SDK - Press Keys Test
 * Converted from: testdriver/acceptance/press-keys.yaml
 * 
 * Original test: create a new tab
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

    // Step: create a new tab
    console.log('\n⌨️  Creating new tab...');
    await client.focusApplication('Google Chrome');
    await client.hoverText('Sign In', 'black button below the password field', 'click');
    
    // Open new tab
    await client.pressKeys(['ctrl', 't']);
    await client.waitForText('Learn more');
    
    // Open DevTools
    await client.pressKeys(['ctrl', 'shift', 'i']);
    await client.waitForText('Elements');
    
    // Open another new tab and navigate to Google
    await client.pressKeys(['ctrl', 't']);
    await client.type('google.com');
    await client.pressKeys(['enter']);
    
    console.log('✅ Tab operations completed');

    // Assert that google appears
    console.log('\n✔️ Asserting Google appears...');
    await client.assert('google appears');
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
