/**
 * Vitest config for runner/packer tests.
 * Lives under sdk/ so vitest resolves from sdk/node_modules,
 * but uses shared/resolve-env.js for environment variable loading.
 */
import { defineConfig } from "vitest/config";
import { createRequire } from "module";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const monoRoot = resolve(__dirname, "..");

const require = createRequire(import.meta.url);
const { resolveEnv } = require("../shared/resolve-env");

const plan = process.env.TD_PLAN || "enterprise";
const env = process.env.TD_CHANNEL || "dev";
const resolved = resolveEnv(env, plan);

// Apply to the main process so test code sees the vars immediately
Object.assign(process.env, resolved);

export default defineConfig({
  test: {
    root: monoRoot,
    testTimeout: 900_000,   // 15 min per test
    hookTimeout: 2_400_000, // 40 min for beforeAll (AMI build + spawn)
    reporters: ["default"],
    include: ["runner/packer/test/**/*.test.mjs"],
    env: resolved,
  },
});
