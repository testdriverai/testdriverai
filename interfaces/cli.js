#!/usr/bin/env node

const { run } = require("@oclif/core");
const sentry = require("../lib/sentry");

// Run oclif (with default command handling built-in)
run()
  .then(() => {
    // Success
  })
  .catch(async (error) => {
    // Capture error in Sentry
    sentry.captureException(error, {
      tags: { component: "cli-init" },
    });
    await sentry.flush();

    console.error("Failed to start TestDriver.ai agent:", error);
    process.exit(1);
  });
