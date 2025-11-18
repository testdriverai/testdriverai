/**
 * TestDriver SDK - Press Keys Test (Vitest)
 * Converted from: testdriver/acceptance/press-keys.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestClient,
  setupTest,
  teardownTest,
} from "./setup/testHelpers.mjs";

describe("Press Keys Test", () => {
  let testdriver;

  beforeAll(async () => {
    testdriver = createTestClient();
    await setupTest(testdriver);
  });

  afterAll(async () => {
    await teardownTest(testdriver);
  });

  it("should create tabs and navigate using keyboard shortcuts", async () => {
    await testdriver.focusApplication("Google Chrome");
    const signInButton = await testdriver.find(
      "Sign In, black button below the password field",
    );
    await signInButton.click();

    // Open new tab
    await testdriver.pressKeys(["ctrl", "t"]);

    // Poll for "Learn more" to appear
    let learnMore = await testdriver.find("Learn more");
    for (let i = 0; i < 10; i++) {
      learnMore = await learnMore.find();
      if (learnMore.found()) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Open DevTools
    await testdriver.pressKeys(["ctrl", "shift", "i"]);

    // Poll for "Elements" to appear
    let elements = await testdriver.find("Elements");
    for (let i = 0; i < 10; i++) {
      elements = await elements.find();
      if (elements.found()) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Open another tab and navigate
    await testdriver.pressKeys(["ctrl", "t"]);
    await testdriver.type("google.com");
    await testdriver.pressKeys(["enter"]);

    // Assert Google appears
    const result = await testdriver.assert("google appears");
    expect(result).toBeTruthy();
  });
});
