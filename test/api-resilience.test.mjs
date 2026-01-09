/**
 * TestDriver SDK - API Resilience Test
 * 
 * This test verifies that TestDriver client can handle API restarts gracefully.
 * It will:
 * 1. Start a sandbox and browser
 * 2. Make some API calls (TestDriver operations)
 * 3. Kill the API (dev.sh)
 * 4. Restart the API
 * 5. Continue making API calls and verify they work
 * 
 * Usage:
 *   npm test -- test/api-resilience.test.mjs
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe("API Resilience Test", () => {
  it("should continue working after API restart", async (context) => {
    const testdriver = TestDriver(context, { 
      newSandbox: true, 
      headless: false 
    });
    
    console.log("\n📋 Step 1: Provision Chrome and navigate to test page");
    await testdriver.provision.chrome({
      url: 'http://testdriver-sandbox.vercel.app/login',
    });

    console.log("✅ Provisioned successfully");

    console.log("\n📋 Step 2: Perform initial test operations");
    const button1 = await testdriver.find("Sign In button");
    console.log("✅ Found Sign In button:", button1.found());
    expect(button1.found()).toBe(true);

    const result1 = await testdriver.assert("I can see a login page");
    console.log("✅ First assertion passed:", result1);
    expect(result1).toBeTruthy();

    console.log("\n📋 Step 3: Simulate API going down");
    console.log("⚠️  Killing dev.sh process...");
    
    try {
      // Kill all node processes running app.js (the API server)
      await execAsync("pkill -f 'node.*app.js'");
      console.log("✅ API killed");
    } catch (error) {
      // pkill returns non-zero exit code if no processes found, which is okay
      console.log("Note: No app.js processes found to kill (or already killed)");
    }

    // Wait a bit to ensure API is down
    console.log("⏳ Waiting 3 seconds to ensure API is down...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log("\n📋 Step 4: Restart API");
    console.log("🔄 Starting dev.sh...");
    
    // Start dev.sh in background
    const apiProcess = spawn('bash', ['dev.sh'], {
      cwd: '/Users/ianjennings/Development/api',
      detached: true,
      stdio: 'ignore'
    });
    
    // Unref so the process doesn't keep this test running
    apiProcess.unref();
    
    console.log("✅ API restarted (PID:", apiProcess.pid, ")");
    
    // Wait for API to be ready
    console.log("⏳ Waiting 10 seconds for API to initialize...");
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log("\n📋 Step 5: Continue test operations after API restart");
    console.log("🔄 Attempting to find element again...");
    
    const button2 = await testdriver.find("Sign In button");
    console.log("✅ Found Sign In button again:", button2.found());
    expect(button2.found()).toBe(true);

    console.log("🔄 Performing another assertion...");
    const result2 = await testdriver.assert("I can see a login page");
    console.log("✅ Second assertion passed:", result2);
    expect(result2).toBeTruthy();

    console.log("\n📋 Step 6: Perform additional operations to verify full functionality");
    const emailInput = await testdriver.find("email input field");
    console.log("✅ Found email input:", emailInput.found());
    expect(emailInput.found()).toBe(true);

    await emailInput.click();
    await testdriver.type("test@example.com");
    console.log("✅ Typed into email field");

    const result3 = await testdriver.assert("the email field contains text");
    console.log("✅ Final assertion passed:", result3);
    expect(result3).toBeTruthy();

    console.log("\n🎉 Test completed successfully! API resilience verified.");
  });
}, {
  timeout: 120000 // 2 minute timeout for this test
});
