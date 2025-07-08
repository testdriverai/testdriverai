#!/usr/bin/env node

console.log("Testing events system...");

try {
  console.log("1. Loading events module...");
  const { events, createEmitter } = require("./agent/events.js");
  console.log("✓ Events loaded successfully");

  console.log("2. Creating emitter instance...");
  const emitter = createEmitter();
  console.log("✓ Emitter created successfully");

  console.log("3. Testing event emission...");
  emitter.on("test-event", (data) => {
    console.log("✓ Received test event:", data);
  });
  emitter.emit("test-event", "Hello from emitter!");

  console.log("4. Loading TestDriverAgent...");
  const TestDriverAgent = require("./agent/index.js");
  console.log("✓ Agent class loaded successfully");

  console.log("5. Creating agent instance...");
  const agent = new TestDriverAgent();
  console.log("✓ Agent instance created successfully");

  console.log("6. Testing agent emitter...");
  console.log("   Agent has emitter:", !!agent.emitter);

  agent.emitter.on("agent-test", (data) => {
    console.log("✓ Received agent event:", data);
  });
  agent.emitter.emit("agent-test", "Hello from agent emitter!");

  console.log("\n✅ All tests passed! Agent.emitter is working correctly.");

  // Exit successfully
  process.exit(0);
} catch (error) {
  console.error("❌ Error:", error.message);
  console.error("Stack:", error.stack);
  process.exit(1);
}
