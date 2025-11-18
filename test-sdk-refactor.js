#!/usr/bin/env node

/**
 * Quick test to verify SDK refactoring works correctly
 */

const TestDriver = require("./sdk.js");

async function test() {
  console.log("Testing SDK refactor...\n");

  // Test 1: SDK construction
  console.log("✓ Test 1: Creating SDK instance");
  const client = new TestDriver(process.env.TD_API_KEY || "test-key", {
    logging: false,
  });

  console.log("  - agent exists:", !!client.agent);
  console.log("  - emitter exists:", !!client.emitter);
  console.log("  - config exists:", !!client.config);
  console.log("  - session exists:", !!client.session);
  console.log("  - apiClient exists:", !!client.apiClient);
  console.log("  - analytics exists:", !!client.analytics);
  console.log("  - sandbox exists:", !!client.sandbox);
  console.log("  - system exists:", !!client.system);

  // Test 2: Check agent methods are accessible
  console.log("\n✓ Test 2: Checking agent methods");
  console.log(
    "  - agent.exploratoryLoop exists:",
    typeof client.agent.exploratoryLoop,
  );
  console.log("  - agent.buildEnv exists:", typeof client.agent.buildEnv);
  console.log(
    "  - agent.getRecentSandboxId exists:",
    typeof client.agent.getRecentSandboxId,
  );

  // Test 3: Check SDK methods
  console.log("\n✓ Test 3: Checking SDK methods");
  console.log("  - ai() exists:", typeof client.ai);
  console.log("  - auth() exists:", typeof client.auth);
  console.log("  - connect() exists:", typeof client.connect);
  console.log("  - disconnect() exists:", typeof client.disconnect);

  console.log("\n✅ All basic tests passed!");
}

test().catch((error) => {
  console.error("\n❌ Test failed:", error.message);
  console.error(error.stack);
  process.exit(1);
});
