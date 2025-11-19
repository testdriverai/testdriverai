/**
 * TestDriver SDK - Formatted Logging Demo
 * Demonstrates nice Vitest-style formatted logs for Dashcam replay
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestClient,
  setupTest,
  teardownTest,
} from "./setup/testHelpers.mjs";

describe("Formatted Logging Demo", () => {
  let testdriver;

  beforeAll(async () => {
    testdriver = createTestClient();

    // Set test context for enhanced logging
    testdriver.setTestContext({
      file: "formatted-logging.test.mjs",
      test: "Formatted Logging Demo",
      startTime: Date.now(),
    });

    await setupTest(testdriver);
  });

  afterAll(async () => {
    await teardownTest(testdriver);
  });

  it("should demonstrate formatted logs in dashcam replay", async () => {
    await testdriver.focusApplication("Google Chrome");

    // Find and click - logs will be nicely formatted
    const signInButton = await testdriver.find(
      "Sign In, black button below the password field",
    );
    await signInButton.click();

    // Assert - logs will show pass/fail with nice formatting
    const result = await testdriver.assert(
      "an error shows that fields are required",
    );
    expect(result).toBeTruthy();
  });
});
