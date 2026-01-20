/**
 * TestDriver SDK - Hover Text With Description Test (Vitest)
 * Converted from: testdriver/acceptance/hover-text-with-description.yaml
 */

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

describe("Hover Text With Description Test", () => {
  it("should add TestDriver Hat to cart and verify", async (context) => {
    const testdriver = TestDriver(context, { ip: context.ip || process.env.TD_IP, headless: true });
    await testdriver.provision.chrome({ url: 'http://testdriver-sandbox.vercel.app/login' });

    //
    // Perform login first
    await performLogin(testdriver);

    // Click on "Add to Cart" under TestDriver Hat
    const addToCartButton = await testdriver.find(
      "Add to Cart, add to cart button under TestDriver Hat",
    );
    await addToCartButton.click();

    // Click on the cart
    const cartButton = await testdriver.find(
      "Cart, cart button in the top right corner",
    );
    await cartButton.click();

    // Assert the TestDriver Hat is in the cart
    const result = await testdriver.assert("TestDriver Hat is in the cart");
    expect(result).toBeTruthy();
  });
});
