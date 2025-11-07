#!/usr/bin/env node

/**
 * TestDriver SDK - Hover Text Test
 * Converted from: testdriver/acceptance/hover-text.yaml
 * 
 * Original test: click on sign in
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

    // Step: click on sign in
    console.log('\n🖱️ Clicking Sign In button...');
    await client.focusApplication('Google Chrome');
    await client.hoverText('Sign In', 'black button below the password field', 'click', undefined, 5000);
    console.log('✅ Sign In clicked');

    // Assert that an error shows that fields are required
    console.log('\n✔️ Asserting error message appears...');
    await client.assert('an error shows that fields are required');
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
