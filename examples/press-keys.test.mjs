/**
 * TestDriver SDK - Press Keys Test (Vitest)
 * Converted from: testdriver/acceptance/press-keys.yaml
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";
import { getDefaults } from "./config.mjs";

describe("Press Keys Test", () => {
  it("should create tabs and navigate using keyboard shortcuts", async (context) => {
    const testdriver = TestDriver(context, { ...getDefaults(context), headless: true });
    await testdriver.provision.chrome({ url: 'http://testdriver-sandbox.vercel.app/login' });

    const signInButton = await testdriver.find(
      "Sign In, black button below the password field",
    );
    await signInButton.click();

    // Open new tab
    await testdriver.pressKeys(["ctrl", "t"]);

    // Poll for "Learn more" to appear
    let imagesLink = await testdriver.find("Images", {timeout: 5000});

    expect(imagesLink.found()).toBeTruthy();

    // Open DevTools
    await testdriver.pressKeys(["ctrl", "shift", "i"]);

    // Poll for "Elements" to appear
    let elements = await testdriver.find("Elements", {timeout: 5000});
    expect(elements.found()).toBeTruthy();

    // Open another tab and navigate
    await testdriver.pressKeys(["ctrl", "t"]);
    await testdriver.type("google.com");
    await testdriver.pressKeys(["enter"]);

    // Assert Google appears
    const result = await testdriver.assert("google appears");
    expect(result).toBeTruthy();
  });
});
