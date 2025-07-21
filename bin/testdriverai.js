#!/usr/bin/env node

// Set process priority if possible
const os = require("os");
try {
  const pid = process.pid;
  os.setPriority(pid, -20);
  // eslint-disable-next-line no-unused-vars
} catch (error) {
  // Ignore if not permitted
}

// Run the CLI
require("../interfaces/cli.js");
