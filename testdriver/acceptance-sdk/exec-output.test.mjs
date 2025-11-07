/**
 * TestDriver SDK - Exec Output Test (Vitest)
 * Converted from: testdriver/acceptance/exec-output.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestClient, setupTest, teardownTest } from './setup/testHelpers.mjs';

describe('Exec Output Test', () => {
  let client;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it('should set date using PowerShell and navigate to calendar', async () => {
    // Generate date in query string format
    const queryString = await client.exec('pwsh', `
$date = (Get-Date).AddMonths(1)
Write-Output $date.ToString("yyyy-MM-dd")
    `, 10000);

    // Assert that the date is valid
    const dateValidResult = await client.assert(`${queryString} is a valid date`);
    expect(dateValidResult).toBeTruthy();

    // Generate date in display format
    const expectedDate = await client.exec('pwsh', `
$date = (Get-Date).AddMonths(1)
Write-Output $date.ToString("ddd MMM d yyyy")
    `, 10000);

    // Navigate to calendar with date parameter
    await client.focusApplication('Google Chrome');
    await client.pressKeys(['ctrl', 'l']);
    await client.type(`https://teamup.com/ks48cf2135e7e080bc?view=d&date=${queryString}`);
    await client.pressKeys(['enter']);

    // Assert that the expected date shows
    await client.focusApplication('Google Chrome');
    const result = await client.assert(`the text ${expectedDate} is visible on screen`);
    expect(result).toBeTruthy();
  });
});
