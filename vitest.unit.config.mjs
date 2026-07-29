import { defineConfig } from "vitest/config";

// Unit tests for SDK internals — pure, no sandbox, no network.
//
// Kept separate from vitest.config.mjs, which drives the real end-to-end
// examples: that config provisions live sandboxes, resolves per-channel API
// keys, and runs with an 8-minute timeout, so it can't host fast unit tests.
// Run with `npm run test:unit`.
export default defineConfig({
  test: {
    include: ["agent/**/*.test.mjs", "lib/**/*.test.mjs"],
    // Don't let the e2e suites' fixtures/setup leak in.
    setupFiles: [],
  },
});
