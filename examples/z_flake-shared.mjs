/**
 * Shared test logic for popup-loading variants.
 * Each variant file imports this and calls it with specific options.
 */
import { describe, expect, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";

export function popupLoadingTest(label, options = {}) {
  describe(`Popup with Loading (${label})`, () => {
    it("should accept cookies and wait for completion", async (context) => {
      const testdriver = TestDriver(context, {
        ip: context.ip || process.env.TD_IP,
        ...options,
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

      // Click Continue to proceed to the image grid
      await testdriver.find("Continue button in the modal").click();

      // Wait for the 5x5 grid of images to fully load (up to 60s) and click the rocket
      await testdriver.find("rocket image in the 5x5 grid", { timeout: 60000 }).click();

      // Assert the success message appears
      const rocketResult = await testdriver.assert("The text 'You found the rocket!' is visible on the page");
      expect(rocketResult).toBeTruthy();
    });
  });
}
