/**
 * TestDriver SDK - Scroll Keyboard Test (Vitest)
 * Converted from: testdriver/acceptance/scroll-keyboard.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestClient,
  setupTest,
  teardownTest,
} from "./setup/testHelpers.mjs";

describe("Scroll Keyboard Test", () => {
  let testdriver;

  beforeAll(async () => {
    testdriver = createTestClient({
      redrawThreshold: 0.5, // Higher threshold for scroll test
    });
    await setupTest(testdriver);
  });

  afterAll(async () => {
    await teardownTest(testdriver);
  });

  it("should navigate to webhamster.com and scroll with keyboard", async () => {
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
    await testdriver.scroll("down", 1000);

    // Assert the page is scrolled down
    const result = await testdriver.assert("the page is scrolled down");
    expect(result).toBeTruthy();
  });
});
