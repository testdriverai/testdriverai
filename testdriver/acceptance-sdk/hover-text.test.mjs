/**
 * TestDriver SDK - Hover Text Test (Vitest)
 * Converted from: testdriver/acceptance/hover-text.yaml
 */

import { describe, expect, it } from "vitest";
import { chrome } from "../../src/presets/index.mjs";

describe("Hover Text Test", () => {
  it("should click Sign In and verify error message", async (context) => {
    const { testdriver } = await chrome(context, {
      url: 'http://testdriver-sandbox.vercel.app/login',
    });

    // Click on Sign In button using new find() API

    const signInButton = await testdriver.find(
      "Sign In, black button below the password field",
    );
    await signInButton.click();

    // Assert that an error shows that fields are required
    const result = await testdriver.assert(
      "an error shows that fields are required",
    );
    expect(result).toBeTruthy();
  });
});
