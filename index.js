#!/usr/bin/env node
const os = require("os");

const TestDriverAgent = require("./agent.js");
const agent = new TestDriverAgent();

try {
  const pid = process.pid;
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
