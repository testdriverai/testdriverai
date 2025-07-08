#!/usr/bin/env node

console.log("Testing BaseCommand with agent.emitter...");

try {
  console.log("1. Loading BaseCommand...");
  const BaseCommand = require("./interfaces/cli/lib/base.js");
  console.log("✓ BaseCommand loaded successfully");

  console.log("2. Creating BaseCommand instance...");
  const cmd = new BaseCommand([], {});
  console.log("✓ BaseCommand instance created");

  console.log("3. Creating agent through setupAgent...");
  // We'll create a minimal test that just tests the agent creation
  // without actually running start() since that might require more setup
  const TestDriverAgent = require("./agent/index.js");
  cmd.agent = new TestDriverAgent();
  console.log("✓ Agent created and assigned to command");

  console.log("4. Testing event listeners setup...");
  cmd.setupEventListeners();
  console.log("✓ Event listeners setup completed");

  console.log("5. Testing event emission...");
  // Test that the events are properly received
  let eventReceived = false;
  const originalConsoleLog = console.log;
  console.log = (...args) => {
    if (args[0].includes("test message")) {
      eventReceived = true;
      console.log = originalConsoleLog;
      console.log("✓ Event received by base.js listener:", args.join(" "));
    }
  };

  cmd.agent.emitter.emit("log:log", "test message from agent");

  setTimeout(() => {
    console.log = originalConsoleLog;
    if (eventReceived) {
      console.log(
        "\n✅ All tests passed! Base.js is properly listening to agent.emitter",
      );
    } else {
      console.log("\n❌ Event was not received by base.js listener");
    }
  }, 100);
} catch (error) {
  console.error("❌ Error:", error.message);
  console.error("Stack:", error.stack);
  process.exit(1);
}
