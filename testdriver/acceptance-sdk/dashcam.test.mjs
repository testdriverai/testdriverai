/**
 * TestDriver SDK - Dashcam Test (Vitest)
 * Converted from: testdriver/acceptance/dashcam.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestClient,
  setupTest,
  storeTestResult,
  teardownTest,
} from "./setup/testHelpers.mjs";

describe("Dashcam Test", () => {
  let testdriver;

  beforeAll(async () => {
    testdriver = createTestClient();
    await setupTest(testdriver);
  });

  afterAll(async () => {
    const sessionInfo = await teardownTest(testdriver);

    // Store test result with dashcam URL for reporting
    storeTestResult(
      "Dashcam Test",
      import.meta.url,
      sessionInfo.dashcamUrl,
      sessionInfo,
    );

    // Log dashcam URL if available
    if (sessionInfo.dashcamUrl) {
      console.log(`\n🎥 Dashcam recording: ${sessionInfo.dashcamUrl}\n`);
    }
  });

  it("should click on Sign In button for dashcam recording", async () => {
    // Simple click test for dashcam recording
    const signInButton = await testdriver.find(
      "Sign In, black button below the password field",
    );
    await signInButton.click();

    // Basic assertion to verify the action
    const result = await testdriver.assert(
      "an error shows that fields are required",
    );
    expect(result).toBeTruthy();
  });
});
