/**
 * TestDriver SDK - Assert Test (Vitest)
 * Converted from: testdriver/acceptance/assert.yaml
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";

describe("Assert Test", () => {
  it("should assert the testdriver login page shows", async (context) => {
    const testdriver = TestDriver(context, { newSandbox: true });
    
    // provision.chrome() automatically calls ready() and starts dashcam
    await testdriver.provision.chrome({
      url: 'http://testdriver-sandbox.vercel.app/login',
    });

    // Assert the TestDriver.ai Sandbox login page is displayed
    const result = await testdriver.assert(
      "the TestDriver.ai Sandbox login page is displayed",
    );

    expect(result).toBeTruthy();
  });
  // it("should assert the testdriver login page shows 2", async (context) => {
  //   const testdriver = TestDriver(context, { newSandbox: true });
    
  //   // provision.chrome() automatically calls ready() and starts dashcam
  //   await testdriver.provision.chrome({
  //     url: 'http://testdriver-sandbox.vercel.app/login',
  //   });

  //   // Assert the TestDriver.ai Sandbox login page is displayed
  //   const result = await testdriver.assert(
  //     "the TestDriver.ai Sandbox login page is displayed",
  //   );

  //   expect(result).toBeTruthy();
  // });
});

