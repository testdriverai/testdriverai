#!/usr/bin/env node

/**
 * TestDriver SDK - Dashcam Test
 * Converted from: testdriver/acceptance/dashcam.yaml
 * 
 * Original test: simple click on sign in (for dashcam recording)
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

    // Step: fetch user data from API (simple click test)
    console.log('\n🖱️ Clicking Sign In button...');
    await client.hoverText('Sign In', 'black button below the password field', 'click');
    console.log('✅ Sign In clicked');

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
