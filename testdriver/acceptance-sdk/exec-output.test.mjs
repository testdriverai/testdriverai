/**
 * TestDriver SDK - Exec Output Test (Vitest)
 * Converted from: testdriver/acceptance/exec-output.yaml
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../../src/vitest/hooks.mjs";

describe("Exec Output Test", () => {
  it.skipIf(process.env.TD_OS === "linux")(
    "should set date using PowerShell and navigate to calendar",
    async (context) => {
      const testdriver = TestDriver(context, { headless: true });
      await testdriver.provision.chrome({ url: 'http://testdriver-sandbox.vercel.app/login' });

      //
      // Generate date in query string format
      const queryString = await testdriver.exec(
        "pwsh",
        `
$date = (Get-Date).AddMonths(1)
Write-Output $date.ToString("yyyy-MM-dd")
    `,
        10000,
      );

      // Assert that the date is valid
      const dateValidResult = await testdriver.assert(
        `${queryString} is a valid date`,
      );
      expect(dateValidResult).toBeTruthy();

      // Generate date in display format
      const expectedDate = await testdriver.exec(
        "pwsh",
        `
$date = (Get-Date).AddMonths(1)
Write-Output $date.ToString("ddd MMM d yyyy")
    `,
        10000,
      );

      // Navigate to calendar with date parameter
      await testdriver.focusApplication("Google Chrome");
      await testdriver.pressKeys(["ctrl", "l"]);
      await testdriver.type(
        `https://teamup.com/ks48cf2135e7e080bc?view=d&date=${queryString}`,
      );
      await testdriver.pressKeys(["enter"]);

      // Assert that the expected date shows
      await testdriver.focusApplication("Google Chrome");
      const result = await testdriver.assert(
        `the text ${expectedDate} is visible on screen`,
      );
      expect(result).toBeTruthy();
    },
  );
});
