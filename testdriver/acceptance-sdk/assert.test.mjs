/**
 * TestDriver SDK - Assert Test (Vitest)
 * Converted from: testdriver/acceptance/assert.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestClient,
  setupTest,
  teardownTest,
} from "./setup/testHelpers.mjs";

describe("Assert Test", () => {
  let testdriver;
  let testContext; // Store test context to access from afterAll

  beforeAll(async (suiteContext) => {
    // In beforeAll, the context IS the suite task
    // We'll use the suite's ID to track logs for all tests in this suite
    testdriver = createTestClient({
      signal: suiteContext.signal,
      task: suiteContext, // The suite context is the task in beforeAll
    });

    // Store platform in task metadata immediately for reporter access
    if (suiteContext.meta) {
      suiteContext.meta.testdriverPlatform = testdriver.os;
    }

    await setupTest(testdriver);
  });

  afterAll(async () => {
    // Pass the test context to teardownTest so it can store dashcam URL in task.meta
    const sessionInfo = await teardownTest(testdriver, {
      task: testContext?.task,
    });
    console.log(
      `[Test] Teardown complete, dashcam URL: ${sessionInfo.dashcamUrl}`,
    );
  });

  it("should assert the testdriver login page shows", async (context) => {
    // Store test context for afterAll to access
    testContext = context;

    // Store platform in task.meta synchronously (must be done before any awaits)
    context.task.meta.testdriverPlatform = testdriver.os;

    // The abort signal is automatically passed through via createTestClient
    // and will cancel all TestDriver operations if the test is stopped

    // Assert the TestDriver.ai Sandbox login page is displayed
    const result = await testdriver.assert(
      "the TestDriver.ai Sandbox login page is displayed",
    );

    expect(result).toBeTruthy();
  });
});
