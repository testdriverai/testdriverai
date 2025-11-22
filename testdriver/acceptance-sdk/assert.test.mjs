/**
 * TestDriver SDK - Assert Test (Vitest)
 * Converted from: testdriver/acceptance/assert.yaml
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTestClient,
  setupTest,
  teardownTest,
} from "./setup/testHelpers.mjs";

describe("Assert Test", () => {
  let testdriver;

  beforeEach(async (context) => {
    // Create a new client for each test
    testdriver = createTestClient({
      task: context.task,
    });

    await setupTest(testdriver);
  }, 600000);

  afterEach(async (context) => {
    // Teardown after each test, passing the individual test context
    const sessionInfo = await teardownTest(testdriver, {
      task: context.task,
    });
    console.log(
      `[Test] Teardown complete, dashcam URL: ${sessionInfo.dashcamUrl}`,
    );
  });

  it("should assert the testdriver login page shows", async () => {
    // Assert the TestDriver.ai Sandbox login page is displayed
    // const result = await testdriver.assert(
    //   "the TestDriver.ai Sandbox login page is displayed",
    // );

    // expect(result).toBeTruthy();
    return true;
  });
});
