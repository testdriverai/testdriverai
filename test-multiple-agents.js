#!/usr/bin/env node

console.log("Testing multiple agent instances...");

try {
  const TestDriverAgent = require("./agent/index.js");

  console.log("Creating first agent...");
  const agent1 = new TestDriverAgent();

  console.log("Creating second agent...");
  const agent2 = new TestDriverAgent();

  console.log("Testing that each agent has its own emitter...");
  console.log("Agent1 emitter:", !!agent1.emitter);
  console.log("Agent2 emitter:", !!agent2.emitter);
  console.log(
    "Emitters are different instances:",
    agent1.emitter !== agent2.emitter,
  );

  // Test that events don't cross between agents
  let agent1EventReceived = false;
  let agent2EventReceived = false;

  agent1.emitter.on("test-event", () => {
    agent1EventReceived = true;
    console.log("✓ Agent1 received its event");
  });

  agent2.emitter.on("test-event", () => {
    agent2EventReceived = true;
    console.log("✓ Agent2 received its event");
  });

  console.log("Emitting event on agent1...");
  agent1.emitter.emit("test-event");

  setTimeout(() => {
    console.log("Agent1 event received:", agent1EventReceived);
    console.log(
      "Agent2 event received (should be false):",
      agent2EventReceived,
    );

    if (agent1EventReceived && !agent2EventReceived) {
      console.log("✅ Events are properly isolated between agents!");
    } else {
      console.log("❌ Event isolation failed!");
    }

    // Test commands are also isolated
    console.log("Testing commands isolation...");
    console.log("Agent1 has commands:", !!agent1.commands);
    console.log("Agent2 has commands:", !!agent2.commands);
    console.log(
      "Commands are different instances:",
      agent1.commands !== agent2.commands,
    );

    if (agent1.commands !== agent2.commands) {
      console.log("✅ Commands are properly isolated between agents!");
    } else {
      console.log("❌ Commands isolation failed!");
    }

    // Test sandbox isolation
    console.log("Testing sandbox isolation...");
    console.log("Agent1 has sandbox:", !!agent1.sandbox);
    console.log("Agent2 has sandbox:", !!agent2.sandbox);
    console.log(
      "Sandbox instances are different:",
      agent1.sandbox !== agent2.sandbox,
    );

    if (agent1.sandbox !== agent2.sandbox) {
      console.log("✅ Sandbox instances are properly isolated between agents!");
    } else {
      console.log("❌ Sandbox isolation failed!");
    }

    // Test commander isolation
    console.log("Testing commander isolation...");
    console.log("Agent1 has commander:", !!agent1.commander);
    console.log("Agent2 has commander:", !!agent2.commander);
    console.log(
      "Commander instances are different:",
      agent1.commander !== agent2.commander,
    );

    if (agent1.commander !== agent2.commander) {
      console.log(
        "✅ Commander instances are properly isolated between agents!",
      );
    } else {
      console.log("❌ Commander isolation failed!");
    }

    process.exit(0);
  }, 100);
} catch (error) {
  console.error("❌ Error:", error.message);
  console.error("Stack:", error.stack);
  process.exit(1);
}
