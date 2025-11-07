#!/usr/bin/env node

/**
 * TestDriver SDK - Scroll Until Image Test
 * Converted from: testdriver/acceptance/scroll-until-image.yaml
 * 
 * Original test: scroll until image of brown colored house
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

    // Navigate to Wikipedia page
    console.log('\n🌐 Navigating to Leonardo da Vinci Wikipedia page...');
    await client.pressKeys(['ctrl', 'l']);
    await client.type('https://en.wikipedia.org/wiki/Leonardo_da_Vinci');
    await client.pressKeys(['enter']);
    console.log('✅ Navigation complete');

    // Click on heading
    await client.hoverText('Leonardo Da Vinci', 'the page heazding', 'click');
    
    // Step: scroll until image
    console.log('\n📜 Scrolling until brown colored house appears...');
    await client.scrollUntilImage('a brown colored house', 'down');
    console.log('✅ Found brown colored house');

    // Assert image of brown colored house appears on screen
    console.log('\n✔️ Asserting image of brown colored house appears...');
    await client.assert('image of brown colored house appears on screen');
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
