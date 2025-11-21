/**
 * TestDriver SDK - Hover Image Test (Vitest)
 * Converted from: testdriver/acceptance/hover-image.yaml
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTestClient,
  performLogin,
  setupTest,
  teardownTest,
} from "./setup/testHelpers.mjs";

describe("Hover Image Test", () => {
  let testdriver;

  beforeEach(async (context) => {
    testdriver = createTestClient({ task: context.task });

    await setupTest(testdriver);
  });

  afterEach(async (context) => {
    await teardownTest(testdriver, { task: context.task });
  });

  it("should click on shopping cart icon and verify empty cart", async () => {
    // Perform login first
    await performLogin(testdriver);

    // Click on the shopping cart icon
    await testdriver.focusApplication("Google Chrome");
    const cartIcon = await testdriver.find(
      "shopping cart icon next to the Cart text in the top right corner",
    );

    await cartIcon.click();

    // Assert that you see an empty shopping cart
    const result = await testdriver.assert("Your cart is empty");
    expect(result).toBeTruthy();
  });
});
