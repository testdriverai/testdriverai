#!/usr/bin/env node

// Set process priority if possible
const os = require("os");
try {
  const pid = process.pid;
  os.setPriority(pid, -20);
} catch (error) {
  // Ignore if not permitted
}

// Run the CLI
require("../interfaces/cli.js");
