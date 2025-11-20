/**
 * TestDriver SDK - Scroll Test (Vitest)
 * Converted from: testdriver/acceptance/scroll.yaml
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTestClient,
  setupTest,
  teardownTest,
} from "./setup/testHelpers.mjs";

describe("Scroll Test", () => {
  let testdriver;

  beforeEach(async (context) => {
    testdriver = createTestClient({ task: context.task });
    
    await setupTest(testdriver);
  });

  afterEach(async (context) => {
    await teardownTest(testdriver, { task: context.task });
  });

  it("should navigate and scroll down the page", async () => {
    // Navigate to webhamster.com
    await testdriver.focusApplication("Google Chrome");
    const urlBar = await testdriver.find(
      "testdriver-sandbox.vercel.app/login, the URL in the omnibox showing the current page",
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
    const result = await testdriver.assert("the page is scrolled down");
    expect(result).toBeTruthy();
  });
});
