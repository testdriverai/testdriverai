/**
 * TestDriver SDK - Match Image Test (Vitest)
 * Converted from: testdriver/acceptance/match-image.yaml
 */

import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";

/**
 * Perform login flow for SauceLabs demo app
 * @param {TestDriver} client - TestDriver client
 * @param {string} username - Username (default: 'standard_user')
 */
async function performLogin(client, username = "standard_user") {
  await client.focusApplication("Google Chrome");
  const password = await client.extract("the password");
  const usernameField = await client.find(
    "Username, label above the username input field on the login form",
  );
  await usernameField.click();
  await client.type(username);
  await client.pressKeys(["tab"]);
  await client.type(password, { secret: true });
  await client.pressKeys(["tab"]);
  await client.pressKeys(["enter"]);
}

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("Match Image Test", () => {
  it.skip("should match shopping cart image and verify empty cart", async (context) => {
    const testdriver = TestDriver(context, { headless: true });
    await testdriver.provision.chrome({ url: 'http://testdriver-sandbox.vercel.app/login' });

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
