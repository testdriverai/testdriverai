import { defineConfig } from "vitest/config";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const monoRoot = resolve(__dirname, "..");

// Unit tests for SDK and runner internals — pure, no sandbox, no network.
//
// Kept separate from vitest.config.mjs, which drives the real end-to-end
// examples: that config provisions live sandboxes, resolves per-channel API
// keys, and runs with an 8-minute timeout, so it can't host fast unit tests.
// Run with `npm run test:unit`.
//
// Rooted at the mono repo so runner/ tests can live here too (same pattern as
// vitest.runner.config.mjs) — dependencies still resolve from sdk/node_modules
// for SDK tests and runner/node_modules for runner tests.
export default defineConfig({
  test: {
    root: monoRoot,
    include: [
      "sdk/agent/**/*.test.mjs",
      "sdk/lib/**/*.test.mjs",
      "runner/lib/**/*.test.mjs",
    ],
    // Don't let the e2e suites' fixtures/setup leak in.
    setupFiles: [],
  },
});
