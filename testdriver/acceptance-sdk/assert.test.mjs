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

  beforeAll(async () => {
    testdriver = createTestClient();
    await setupTest(testdriver);
  });

  afterAll(async () => {
    await teardownTest(testdriver);
  });

  it("should assert the testdriver login page shows", async () => {
    // Assert the TestDriver.ai Sandbox login page is displayed
    const result = await testdriver.assert(
      "the TestDriver.ai Sandbox login page is displayed",
    );

    expect(result).toBeTruthy();
  });
});
