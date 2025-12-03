/**
 * TestDriver SDK - Scroll Test (Vitest)
 * Converted from: testdriver/acceptance/scroll.yaml
 * 
 * UPDATED: Now using chrome preset for automatic setup
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";

describe("Scroll Test", () => {
  it("should navigate and scroll down the page", async (context) => {
    const testdriver = TestDriver(context, { headless: true });
    await testdriver.provision.chrome({ url: 'http://testdriver-sandbox.vercel.app/login' });

    // Give Chrome a moment to fully render the UI
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Navigate to webhamster.com - just look for the domain, not the full path
    const urlBar = await testdriver.find(
      "testdriver-sandbox.vercel.app, the URL in the address bar",
    );
    await urlBar.click();
    await testdriver.pressKeys(["ctrl", "a"]);
    await testdriver.type("https://www.webhamster.com/");
    await testdriver.pressKeys(["enter"]);

    // Wait for page to load and click heading
    const heading = await testdriver.find(
      "The Hamster Dance, large heading at top of page",
    );
    await heading.click();

    // Scroll down
    await testdriver.scroll("down", 1000);

    // Assert page is scrolled
    const result = await testdriver.assert("the page is scrolled down, the hamster dance heading is not visible on the page");
    expect(result).toBeTruthy();
  });
});
