/**
 * TestDriver SDK - Scroll Test (Vitest)
 * Converted from: testdriver/acceptance/scroll.yaml
 * 
 * UPDATED: Now using chrome preset for automatic setup
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";
import { getDefaults } from "./config.mjs";

describe("Scroll Test", () => {
  it("should navigate and scroll down the page", async (context) => {
    const testdriver = TestDriver(context, { ...getDefaults(context), headless: true });
    await testdriver.provision.chrome({ url: 'https://www.webhamster.com/' });


    // Wait for page to load and click heading
    const heading = await testdriver.find(
      "The Hamster Dance, large heading at top of page",
    );
    await heading.click();

    // Scroll down
    await testdriver.scroll("down", { amount: 1000 });

    // Assert page is scrolled
    const result = await testdriver.assert("The text 'The Hamster Dance' is not visible on the webpage content. It's ok if it's visible in the tab title.");
    expect(result).toBeTruthy();
  });
});
