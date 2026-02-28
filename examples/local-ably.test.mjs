/**
 * Local Ably test - runs against local runner
 * 
 * Usage:
 *   1. Start the local runner first (it prints the sandboxId)
 *   2. Run this test with the sandboxId:
 *      TD_SANDBOX_ID=sb-xxx TD_API_ROOT=http://localhost:1337 vitest run examples/local-ably.test.mjs
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";

describe("Local Ably Test", () => {
  it("should connect to local runner and execute commands", async (context) => {
    const sandboxId = process.env.TD_SANDBOX_ID;
    
    if (!sandboxId) {
      console.log("TD_SANDBOX_ID not set - starting fresh sandbox");
    } else {
      console.log(`Reconnecting to sandbox: ${sandboxId}`);
    }
    
    const testdriver = TestDriver(context, {
      sandboxId: sandboxId || undefined,
      ip: sandboxId ? undefined : "127.0.0.1", // Use IP only if no sandboxId
      newSandbox: !sandboxId, // Only create new if no sandboxId provided
    });
    
    // Connect to sandbox
    await testdriver.connect();
    
    console.log("Connected to sandbox!");
    console.log("Instance:", testdriver.instance);
    
    // Try a simple command - take a screenshot
    const screenshot = await testdriver.screenshot();
    console.log("Screenshot taken!");
    
    // Simple assertion - we're connected
    expect(testdriver.connected).toBe(true);
    
    console.log("Test passed!");
  });
});
