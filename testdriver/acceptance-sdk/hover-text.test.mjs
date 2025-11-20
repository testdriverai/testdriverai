/**
 * TestDriver SDK - Hover Text Test (Vitest)
 * Converted from: testdriver/acceptance/hover-text.yaml
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTestClient,
  setupTest,
  teardownTest,
} from "./setup/testHelpers.mjs";

describe("Hover Text Test", () => {
  let testdriver;

  beforeEach(async (context) => {
    testdriver = createTestClient({ task: context.task });
    
    
    await setupTest(testdriver);
  });

  afterEach(async (context) => {
    await teardownTest(testdriver, { task: context.task });
  });

  it("should click Sign In and verify error message", async () => {
    // Click on Sign In button using new find() API
    await testdriver.focusApplication("Google Chrome");

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
