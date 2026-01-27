import { config } from "dotenv";
import TestDriver from "testdriverai/vitest";
import { defineConfig } from "vitest/config";

// Load .env file early so it's available to the reporter (runs in main process)
// and to worker processes
config();

// Always include AWS setup - it will be a no-op unless TD_OS=windows
const setupFiles = [
  "dotenv/config",
  "testdriverai/vitest/setup",
  "testdriverai/vitest/setup-aws",
];

export default defineConfig({
  test: {
    testTimeout: 900000,
    hookTimeout: 900000,
    disableConsoleIntercept: true,
    maxConcurrency: 3,
    reporters: [
      "default",
      TestDriver(),
      ["junit", { outputFile: "test-report.junit.xml" }],
    ],
    setupFiles,
  },
});
