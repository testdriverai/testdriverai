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

  beforeAll(async (context) => {
    // Pass the task context so the client can be registered in the global registry
    testdriver = createTestClient({ signal: context.signal, task: context.task });
    
    // Store platform in task metadata immediately for reporter access
    if (context.task?.meta) {
      context.task.meta.testdriverPlatform = testdriver.os;
      console.log(`[Test] Stored platform in task.meta: ${testdriver.os}`);
    }
    
    await setupTest(testdriver);
  });

  afterAll(async () => {
    // Pass the test context to teardownTest so it can store dashcam URL in task.meta
    const sessionInfo = await teardownTest(testdriver, { task: testContext?.task });
    console.log(`[Test] Teardown complete, dashcam URL: ${sessionInfo.dashcamUrl}`);
  });

  it("should assert the testdriver login page shows", async (context) => {
    // Store test context for afterAll to access
    testContext = context;
    
    // Store platform in task.meta synchronously (must be done before any awaits)
    context.task.meta.testdriverPlatform = testdriver.os;
    console.log(`[Test] Stored platform in task.meta for test: ${context.task.name}`);
    console.log(`[Test] task.meta after setting:`, context.task.meta);
    
    // The abort signal is automatically passed through via createTestClient
    // and will cancel all TestDriver operations if the test is stopped
    
    // Assert the TestDriver.ai Sandbox login page is displayed
    const result = await testdriver.assert(
      "the TestDriver.ai Sandbox login page is displayed",
    );

    expect(result).toBeTruthy();
  });
});
