const TestDriverAgent = require("./agent/index.js");

// Test the --new-sandbox flag
async function testNewSandboxFlag() {
  console.log("Testing --new-sandbox flag...");

  const agent = new TestDriverAgent();

  // Test with --new-sandbox flag
  const optionsWithNewSandbox = {
    "new-sandbox": true,
    headless: true,
  };

  // Mock the agent methods to avoid actually creating a sandbox
  agent.connectToSandboxService = async () => {
    console.log("Mock: connectToSandboxService called");
  };

  agent.getRecentSandboxId = () => {
    console.log("Mock: getRecentSandboxId called");
    return "existing-sandbox-id";
  };

  agent.createNewSandbox = async () => {
    console.log(
      "Mock: createNewSandbox called - This should be called when --new-sandbox is true",
    );
    return { sandbox: { instanceId: "new-sandbox-id" } };
  };

  agent.connectToSandboxDirect = async (id) => {
    console.log(`Mock: connectToSandboxDirect called with id: ${id}`);
    return { instanceId: id };
  };

  agent.renderSandbox = async () => {
    console.log("Mock: renderSandbox called");
  };

  agent.newSession = async () => {
    console.log("Mock: newSession called");
  };

  agent.runLifecycle = async () => {
    console.log("Mock: runLifecycle called");
  };

  agent.saveLastSandboxId = () => {
    console.log("Mock: saveLastSandboxId called");
  };

  agent.emitter.emit = (event, message) => {
    console.log(`Event: ${event} - ${message}`);
  };

  try {
    await agent.buildEnv(optionsWithNewSandbox);
    console.log("✅ --new-sandbox flag test passed!");
  } catch (error) {
    console.error("❌ --new-sandbox flag test failed:", error);
  }

  console.log("\nAgent state:");
  console.log("- newSandbox:", agent.newSandbox);
  console.log("- sandboxId:", agent.sandboxId);
}

testNewSandboxFlag().catch(console.error);
