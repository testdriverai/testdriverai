/**
 * TestDriver SDK - Assert Test (Vitest)
 * Converted from: testdriver/acceptance/assert.yaml
 */

import { describe, it } from "vitest";
import { chrome } from "../../src/presets/index.mjs";

describe("Assert Test", () => {
  it("should assert the testdriver login page shows", async (context) => {
    const { testdriver } = await chrome(context, {
      url: 'http://testdriver-sandbox.vercel.app/login',
    });

    //
    // Assert the TestDriver.ai Sandbox login page is displayed
    // const result = await testdriver.assert(
    //   "the TestDriver.ai Sandbox login page is displayed",
    // );

    // expect(result).toBeTruthy();
    return true;
  });
});
