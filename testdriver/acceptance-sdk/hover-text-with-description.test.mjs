/**
 * TestDriver SDK - Hover Text With Description Test (Vitest)
 * Converted from: testdriver/acceptance/hover-text-with-description.yaml
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../../src/vitest/hooks.mjs";
import { performLogin } from "./setup/testHelpers.mjs";

describe("Hover Text With Description Test", () => {
  it("should add TestDriver Hat to cart and verify", async (context) => {
    const testdriver = TestDriver(context, { headless: true });
    await testdriver.provision.chrome({ url: 'http://testdriver-sandbox.vercel.app/login' });

    //
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
