/**
 * TestDriver SDK - Type Test (Vitest)
 * Converted from: testdriver/acceptance/type.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestClient,
  setupTest,
  teardownTest,
} from "./setup/testHelpers.mjs";

describe("Type Test", () => {
  let client;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it("should enter standard_user in username field", async () => {
    await client.focusApplication("Google Chrome");
    const usernameField = await client.find(
      "Username, input field for username",
    );
    await usernameField.click();
    await client.type("standard_user");

    // Assert username field contains "standard_user"
    const result = await client.assert(
      'the username field contains "standard_user"',
    );
    expect(result).toBeTruthy();
  });

  it("should show validation message when clicking Sign In without password", async () => {
    const signInButton = await client.find(
      "Sign in, black button below the password field",
    );
    await signInButton.click();

    // Assert validation message appears
    await client.focusApplication("Google Chrome");
    const result = await client.assert(
      "Please fill out this field is visible near the password field",
    );
    expect(result).toBeTruthy();
  });
});
