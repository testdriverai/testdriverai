#!/usr/bin/env node
const os = require("os");

try {
  const pid = process.pid;
  os.setPriority(pid, -20);
  // eslint-disable-next-line no-unused-vars
} catch (error) {
  // console.error('Failed to set process priority:', error);
}

// Use the new oclif-based CLI
require("./interfaces/cli.js");
