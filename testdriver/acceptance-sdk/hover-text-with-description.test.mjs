/**
 * TestDriver SDK - Hover Text With Description Test (Vitest)
 * Converted from: testdriver/acceptance/hover-text-with-description.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestClient,
  performLogin,
  setupTest,
  teardownTest,
} from "./setup/testHelpers.mjs";

describe("Hover Text With Description Test", () => {
  let testdriver;

  beforeAll(async () => {
    testdriver = createTestClient();
    await setupTest(testdriver);
  });

  afterAll(async () => {
    await teardownTest(testdriver);
  });

  it("should add TestDriver Hat to cart and verify", async () => {
    // Perform login first
    await performLogin(testdriver);

    // Click on "Add to Cart" under TestDriver Hat
    await testdriver.focusApplication("Google Chrome");
    const addToCartButton = await testdriver.find(
      "Add to Cart, add to cart button under TestDriver Hat",
    );
    await addToCartButton.click();

    // Click on the cart
    await testdriver.focusApplication("Google Chrome");
    const cartButton = await testdriver.find(
      "Cart, cart button in the top right corner",
    );
    await cartButton.click();

    // Assert the TestDriver Hat is in the cart
    await testdriver.focusApplication("Google Chrome");
    const result = await testdriver.assert("TestDriver Hat is in the cart");
    expect(result).toBeTruthy();
  });
});
