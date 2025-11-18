/**
 * TestDriver SDK - Hover Image Test (Vitest)
 * Converted from: testdriver/acceptance/hover-image.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestClient,
  performLogin,
  setupTest,
  teardownTest,
} from "./setup/testHelpers.mjs";

describe("Hover Image Test", () => {
  let client;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it("should click on shopping cart icon and verify empty cart", async () => {
    // Perform login first
    await performLogin(client);

    // Click on the shopping cart icon
    await client.focusApplication("Google Chrome");
    const cartIcon = await client.find(
      "shopping cart icon next to the Cart text in the top right corner",
    );

    await cartIcon.click();

    // Assert that you see an empty shopping cart
    const result = await client.assert("Your cart is empty");
    expect(result).toBeTruthy();
  });
});
