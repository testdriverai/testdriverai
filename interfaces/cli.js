#!/usr/bin/env node

const { run } = require("@oclif/core");

// Run oclif (with default command handling built-in)
run()
  .then(() => {
    // Success
  })
  .catch((error) => {
    console.error("Failed to start TestDriver.ai agent:", error);
    process.exit(1);
  });
