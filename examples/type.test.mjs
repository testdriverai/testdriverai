import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";

describe("Type Test", () => {
  it("should enter standard_user in username field", async (context) => {
    const testdriver = TestDriver(context, { ip: context.ip || process.env.TD_IP, headless: true });
    await testdriver.provision.chrome({ url: 'http://testdriver-sandbox.vercel.app/login' });

    //
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

  it("should show validation message when clicking Sign In without password", async (context) => {
    const testdriver = TestDriver(context, { ip: context.ip || process.env.TD_IP, headless: true });
    await testdriver.provision.chrome({ url: 'http://testdriver-sandbox.vercel.app/login' });

    // First fill in username
    const usernameField = await testdriver.find(
      "Username, input field for username",
    );
    await usernameField.click();
    await testdriver.type("standard_user");

    //
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
