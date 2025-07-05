#!/usr/bin/env node
let agent = require("./agent.js");

(async () => {
  try {
    await agent.start();
  } catch (error) {
    console.error("Failed to start TestDriver.ai agent:", error);
    process.exit(1);
  }
})();
