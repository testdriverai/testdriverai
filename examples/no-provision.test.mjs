/**
 * TestDriver SDK - Assert Test (Vitest)
 * Converted from: testdriver/acceptance/assert.yaml
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";
import { getDefaults } from "./config.mjs";

describe("Assert Test", () => {
  it("should assert the testdriver login page shows", async (context) => {
    const testdriver = TestDriver(context, { ...getDefaults(context) });

    await testdriver.wait(10000)
    
    // Assert the TestDriver.ai Sandbox login page is displayed
    const result = await testdriver.assert(
      "A desktop is visible",
    );

    expect(result).toBeTruthy();
  });
});

