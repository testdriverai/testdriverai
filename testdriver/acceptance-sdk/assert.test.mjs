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

  beforeAll(async ({ signal }) => {
    testdriver = createTestClient({ signal });
    await setupTest(testdriver);
  });

  afterAll(async () => {
    await teardownTest(testdriver);
  });

  it("should assert the testdriver login page shows", async () => {
    // The abort signal is automatically passed through via createTestClient
    // and will cancel all TestDriver operations if the test is stopped
    
    // Assert the TestDriver.ai Sandbox login page is displayed
    const result = await testdriver.assert(
      "the TestDriver.ai Sandbox login page is displayed",
    );

    expect(result).toBeTruthy();
  });
});
