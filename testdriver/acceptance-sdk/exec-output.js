#!/usr/bin/env node

/**
 * TestDriver SDK - Exec Output Test
 * Converted from: testdriver/acceptance/exec-output.yaml
 * 
 * Original test: set the date for our test using PowerShell
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

    // Step 1: set the date for our test (query string format)
    console.log('\n💻 Generating date (query string format)...');
    const queryString = await client.exec('pwsh', `
$date = (Get-Date).AddMonths(1)
Write-Output $date.ToString("yyyy-MM-dd")
    `, 10000);
    console.log('✅ Query string date:', queryString);

    // Assert that the date is valid
    console.log('\n✔️ Asserting date is valid...');
    await client.assert(`${queryString} is a valid date`);
    console.log('✅ Assertion passed!');

    // Step 2: set the date for our assertion (display format)
    console.log('\n💻 Generating date (display format)...');
    const expectedDate = await client.exec('pwsh', `
$date = (Get-Date).AddMonths(1)
Write-Output $date.ToString("ddd MMM d yyyy")
    `, 10000);
    console.log('✅ Expected date:', expectedDate);

    // Navigate to calendar with date parameter
    console.log('\n🌐 Navigating to calendar with date parameter...');
    await client.focusApplication('Google Chrome');
    await client.pressKeys(['ctrl', 'l']);
    await client.type(`https://teamup.com/ks48cf2135e7e080bc?view=d&date=${queryString}`);
    await client.pressKeys(['enter']);
    console.log('✅ Navigation complete');

    // Assert that the expected date shows
    console.log('\n✔️ Asserting expected date is visible...');
    await client.focusApplication('Google Chrome');
    await client.assert(`the text ${expectedDate} is visible on screen`);
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
