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
  let client;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it("should create tabs and navigate using keyboard shortcuts", async () => {
    await client.focusApplication("Google Chrome");
    const signInButton = await client.find(
      "Sign In, black button below the password field",
    );
    await signInButton.click();

    // Open new tab
    await client.pressKeys(["ctrl", "t"]);

    // Poll for "Learn more" to appear
    let learnMore = await client.find("Learn more");
    for (let i = 0; i < 10; i++) {
      learnMore = await learnMore.find();
      if (learnMore.found()) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Open DevTools
    await client.pressKeys(["ctrl", "shift", "i"]);

    // Poll for "Elements" to appear
    let elements = await client.find("Elements");
    for (let i = 0; i < 10; i++) {
      elements = await elements.find();
      if (elements.found()) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Open another tab and navigate
    await client.pressKeys(["ctrl", "t"]);
    await client.type("google.com");
    await client.pressKeys(["enter"]);

    // Assert Google appears
    const result = await client.assert("google appears");
    expect(result).toBeTruthy();
  });
});
