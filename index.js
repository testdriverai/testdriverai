#!/usr/bin/env node
const os = require("os");

const TestDriverAgent = require("./agent.js");

// Create an instance of the agent
const agent = new TestDriverAgent();

// Get the current process ID
const pid = process.pid;

try {
  // Set the priority to the highest value
  os.setPriority(pid, -20);
  // eslint-disable-next-line no-unused-vars
} catch (error) {
  // console.error('Failed to set process priority:', error);
}

(async () => {
  try {
    await agent.start();
  } catch (error) {
    console.error("Failed to start TestDriver.ai agent:", error);
    process.exit(1);
  }
})();
