/**
 * TestDriver SDK - Scroll Keyboard Test (Vitest)
 * Converted from: testdriver/acceptance/scroll-keyboard.yaml
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";

describe("Scroll Keyboard Test", () => {
  it("should navigate to webhamster.com and scroll with keyboard", async (context) => {
    const testdriver = TestDriver(context, { ip: context.ip || process.env.TD_IP, headless: true });
    await testdriver.provision.chrome({ url: 'http://testdriver-sandbox.vercel.app/login' });

    //
    // Navigate to https://www.webhamster.com/
    await testdriver.focusApplication("Google Chrome");
    const urlBar = await testdriver.find(
      "testdriver-sandbox.vercel.app/login, the URL in the omnibox showing the current page",
    );
    await urlBar.click();
    await testdriver.pressKeys(["ctrl", "a"]);
    await testdriver.type("https://www.webhamster.com/");
    await testdriver.pressKeys(["enter"]);

    // Scroll down with keyboard 1000 pixels
    const heading = await testdriver.find(
      "The Hamster Dance, large heading at top of page",
    );
    await heading.click();
    await testdriver.scroll("down", { amount: 1000 });

    // Assert the page is scrolled down
    const result = await testdriver.assert("The text 'The Hamster Dance' is not visible on the webpage content. It's ok if it's visible in the tab title.");

    expect(result).toBeTruthy();
  });
});
