/**
 * TestDriver SDK - Hover Image Test (Vitest)
 * Converted from: testdriver/acceptance/hover-image.yaml
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";
import { performLogin } from "./setup/testHelpers.mjs";

describe("Hover Image Test", () => {
  it("should click on shopping cart icon and verify empty cart", async (context) => {
    const testdriver = TestDriver(context, { headless: true });
    
    // provision.chrome() automatically calls ready() and starts dashcam
    await testdriver.provision.chrome({
      url: 'http://testdriver-sandbox.vercel.app/login',
    });

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
