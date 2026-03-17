import TestDriver from "testdriverai/vitest";
import { defineConfig } from "vitest/config";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { resolveEnv, getEnvironmentNames } = require("../shared/resolve-env");

// Always include AWS setup - it will be a no-op unless TD_OS=windows
// Note: dotenv is loaded automatically by the TestDriver SDK
const setupFiles = [
  "testdriverai/vitest/setup",
  "testdriverai/vitest/setup-aws"
];

const sharedTestConfig = {
  retry: 0,
  testTimeout: 900000,
  hookTimeout: 900000,
  maxConcurrency: 100,
  disableConsoleIntercept: false,
  silent: false,
  reporters: [
    "verbose",
    TestDriver()
  ],
  setupFiles,
  include: ["examples/**/*.test.mjs"],
};

// ── Resolve env vars via shared/resolve-env.js ──────────────────────
// Uses: environments.json (URLs) + envs/{env}.env (overlay) + fixtures (API keys)
// TD_PLAN selects which plan's API key to use (default: enterprise)
const plan = process.env.TD_PLAN || "enterprise";
const defaultEnv = process.env.TD_ENV || "dev";
const environments = getEnvironmentNames();

// Apply default env to the main process so the reporter/plugin picks it up
// (vitest's test.env only propagates to worker processes, not the main process)
const defaultResolved = resolveEnv(defaultEnv, plan);
Object.assign(process.env, defaultResolved);

// ── Usage ───────────────────────────────────────────────────────────
// TD_PLAN=enterprise vitest run --project dev
// TD_PLAN=free vitest run --project test examples/assert.test.mjs
// vitest run --project canary --project stable
export default defineConfig({
  test: {
    ...sharedTestConfig,
    env: defaultResolved,
    projects: environments.map((envName) => ({
      extends: true,
      test: {
        name: envName,
        env: resolveEnv(envName, plan),
      },
    })),
  },
});
