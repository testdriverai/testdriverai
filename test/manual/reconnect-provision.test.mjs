/**
 * TestDriver SDK - Reconnect Test Part 1: Provision
 * 
 * This test provisions a new sandbox and navigates to the login page.
 * The sandbox ID is saved to .testdriver/last-sandbox for the next test.
 * 
 * The sandbox has keepAlive: 120000 (2 minutes) after disconnect.
 * Run reconnect-signin.test.mjs within 2 minutes of this test completing.
 * 
 * Usage:
 *   1. npm test -- test/testdriver/reconnect-provision.test.mjs
 *   2. (within 2 minutes) npm test -- test/testdriver/reconnect-signin.test.mjs
 */

import { afterAll, describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";

describe("Reconnect Test - Part 1: Provision", () => {

  afterAll(async () => {
    // Explicitly DO NOT disconnect - we want the sandbox to stay alive
    // for the reconnect test. The sandbox will auto-terminate after keepAlive TTL.
    console.log("\n⚠️  NOT disconnecting - sandbox will stay alive for ~2 minutes (keepAlive: 120000)");
    console.log("   Run reconnect-signin.test.mjs within 2 minutes to test reconnect\n");
  });

  it("should provision sandbox and navigate to login page", async (context) => {

    const testdriver = TestDriver(context, { newSandbox: true, headless: false });
    
    // Provision Chrome and navigate to login page
    await testdriver.provision.chrome({
      url: 'http://testdriver-sandbox.vercel.app/login',
    });


    // Verify we're on the login page
    const result = await testdriver.assert("I can see a Sign In button");
    expect(result).toBeTruthy();

    // Get the sandbox ID that was saved
    const lastSandbox = testdriver.getLastSandboxId();
    console.log("\n✅ Sandbox provisioned:", lastSandbox?.sandboxId);
    console.log("   Sandbox info saved to .testdriver/last-sandbox");
    
    expect(lastSandbox).toBeTruthy();
    expect(lastSandbox.sandboxId).toBeTruthy();
  });
});
