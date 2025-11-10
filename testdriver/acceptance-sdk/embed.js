#!/usr/bin/env node

/**
 * TestDriver SDK - Embed Test
 * Converted from: testdriver/acceptance/embed.yaml
 * 
 * Original test: run login test
 * 
 * Note: This test requires running the login snippet (snippets/login.yaml).
 * You may need to implement the login flow directly or create a reusable function.
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

    // Note: Original test runs snippets/login.yaml
    console.log('\n⚠️  Note: This test requires the login flow to be implemented');
    console.log('⚠️  You should create a reusable login function or implement it here');

    // Step: run login test
    // TODO: Implement login flow here
    // Example:
    // await performLogin(client);

    // Assert home page appears
    console.log('\n✔️ Asserting home page appears...');
    await client.assert('home page appears');
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
