/**
 * TestDriver SDK - Focus Window Test (Vitest)
 * Converted from: testdriver/acceptance/focus-window.yaml
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";

describe("Focus Window Test", () => {
  it.skip(
    "should click Microsoft Edge icon and focus Google Chrome",
    async (context) => {
      const testdriver = TestDriver(context, { headless: true });
      await testdriver.provision.chrome({ url: 'http://testdriver-sandbox.vercel.app/login' });

      //
      // Show desktop
      await testdriver.pressKeys(["winleft", "d"]);

      // Click on the Microsoft Edge icon
      const edgeIcon = await testdriver.find(
        "a blue and green swirl icon on the taskbar representing Microsoft Edge",
      );
      await edgeIcon.click();

      // Focus Google Chrome
      await testdriver.focusApplication("Google Chrome");

      // Assert Chrome is focused (implicit through successful focus)
      const result = await testdriver.assert(
        "Google Chrome is the focused application",
      );
      expect(result).toBeTruthy();
    },
  );
});
