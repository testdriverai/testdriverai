/**
 * TestDriver SDK - Reconnect Test Part 2: Sign In
 * 
 * This test reconnects to the sandbox provisioned by reconnect-provision.test.mjs
 * and clicks the Sign In button.
 * 
 * IMPORTANT: Run this within 2 minutes of reconnect-provision.test.mjs completing.
 * The sandbox auto-terminates after the keepAlive TTL (default 2 minutes).
 * 
 * Usage:
 *   1. npm test -- test/testdriver/reconnect-provision.test.mjs
 *   2. (within 2 minutes) npm test -- test/testdriver/reconnect-signin.test.mjs
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";

describe("Reconnect Test - Part 2: Sign In", () => {

  it("should reconnect to existing sandbox and click Sign In", async (context) => {

    const testdriver = TestDriver(context, { newSandbox: true, headless: false, reconnect: true });
    
    // Provision Chrome and navigate to login page
    await testdriver.provision.chrome({
      url: 'http://testdriver-sandbox.vercel.app/login',
    });

    // Click on Sign In button - the page should already be loaded from provision test
    const signInButton = await testdriver.find(
      "Sign In, black button below the password field",
    );
    await signInButton.click();

    // Assert that an error shows that fields are required
    const result = await testdriver.assert(
      "an error shows that fields are required",
    );
    expect(result).toBeTruthy();
  });
});
