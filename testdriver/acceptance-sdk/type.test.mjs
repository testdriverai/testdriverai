import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestClient,
  setupTest,
  teardownTest,
} from "./setup/testHelpers.mjs";

describe.sequential("Type Test", () => {
  let testdriver;

  beforeAll(async () => {
    testdriver = createTestClient();
    await setupTest(testdriver);
  });

  afterAll(async () => {
    await teardownTest(testdriver);
  });

  it("should enter standard_user in username field", async () => {
    await testdriver.focusApplication("Google Chrome");
    const usernameField = await testdriver.find(
      "Username, input field for username",
    );
    await usernameField.click();
    await testdriver.type("standard_user");

    const result = await testdriver.assert(
      'the username field contains "standard_user"',
    );
    expect(result).toBeTruthy();
  });

  it("should show validation message when clicking Sign In without password", async () => {
    const signInButton = await testdriver.find(
      "Sign in, black button below the password field",
    );
    await signInButton.click();

    await testdriver.focusApplication("Google Chrome");
    const result = await testdriver.assert(
      "Please fill out this field is visible near the password field",
    );
    expect(result).toBeTruthy();
  });
});
