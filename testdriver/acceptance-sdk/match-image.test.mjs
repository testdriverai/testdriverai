/**
 * TestDriver SDK - Match Image Test (Vitest)
 * Converted from: testdriver/acceptance/match-image.yaml
 */

import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { chrome } from "../../src/presets/index.mjs";
import { performLogin } from "./setup/testHelpers.mjs";

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("Match Image Test", () => {
  it("should match shopping cart image and verify empty cart", async (context) => {
    const { testdriver } = await chrome(context, {
      url: 'http://testdriver-sandbox.vercel.app/login',
    });

    //
    // Perform login first
    await performLogin(testdriver);

    // Match and click the shopping cart icon
    const cartImagePath = path.resolve(
      __dirname,
      "../../_testdriver/acceptance/screenshots/cart.png",
    );
    await testdriver.matchImage(cartImagePath, "click");

    // Assert that you see an empty shopping cart
    const result = await testdriver.assert("Your cart is empty");
    expect(result).toBeTruthy();
  });
});
