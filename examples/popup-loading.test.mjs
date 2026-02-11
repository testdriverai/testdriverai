/**
 * TestDriver SDK - Popup with Loading Test (Vitest)
 *
 * Tests the popup loading flow:
 * 1. Accept the cookie banner
 * 2. Wait for "All done!" to appear (120s timeout)
 *
 * Flow: page loads → cookie banner appears → accept cookies →
 *       loading popup with progress bar → "All done!" modal appears
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";

describe("Popup with Loading", () => {
  it("should accept cookies and wait for completion", async (context) => {
    const testdriver = TestDriver(context, {
      ip: context.ip || process.env.TD_IP,
    });

    await testdriver.provision.chrome({
      url: "https://v0-popup-with-loading-bar.vercel.app/",
    });
    await testdriver.screenshot();

    // Accept the cookie banner to trigger the loading process
    await testdriver.find("Accept All button on the cookie banner").click();
    await testdriver.screenshot();

    // Wait for "All done!" to appear with 120s timeout
    const allDone = await testdriver.find("All done! text or heading in a modal or popup", { timeout: 120000 });
    await testdriver.screenshot();

    const result = await testdriver.assert("The text 'All done!' is visible on the page");
    expect(result).toBeTruthy();
  });
});
