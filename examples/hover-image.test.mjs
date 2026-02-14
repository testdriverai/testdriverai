/**
 * TestDriver SDK - Hover Image Test (Vitest)
 * Converted from: testdriver/acceptance/hover-image.yaml
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";
import { getDefaults } from "./config.mjs";

/**
 * Perform login flow for SauceLabs demo app
 * @param {import('../../sdk.js').default} client - TestDriver client instance
 * @param {string} username - Username (default: 'standard_user')
 */
async function performLogin(client, username = "standard_user") {
  await client.focusApplication("Google Chrome");
  const password = await client.extract("the password");
  const usernameField = await client.find(
    "username input",
  );
  await usernameField.click();
  await client.type(username);
  await client.pressKeys(["tab"]);
  await client.type(password, { secret: true });
  await client.pressKeys(["tab"]);
  await client.pressKeys(["enter"]);
}

describe("Hover Image Test", () => {
  it("should click on shopping cart icon and verify empty cart", async (context) => {
    const testdriver = TestDriver(context, { ...getDefaults(context) });
    
    // provision.chrome() automatically calls ready() and starts dashcam
    await testdriver.provision.chrome({
      url: 'http://testdriver-sandbox.vercel.app/login'
    });

    // Give Chrome a moment to fully render the login page
    await new Promise(resolve => setTimeout(resolve, 2000));

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
