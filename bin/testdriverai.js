#!/usr/bin/env node

// Initialize Sentry first, before any other modules
const sentry = require("../lib/sentry");

// Set process priority if possible
const os = require("os");
try {
  const pid = process.pid;
  os.setPriority(pid, -20);
  // eslint-disable-next-line no-unused-vars
} catch (error) {
  // Ignore if not permitted
}

// Ensure Sentry flushes on exit
process.on("beforeExit", async () => {
  await sentry.flush();
});

// Run the CLI
require("../interfaces/cli.js");
