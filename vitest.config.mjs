import TestDriver from "testdriverai/vitest";
import { defineConfig } from "vitest/config";

// Always include AWS setup - it will be a no-op unless TD_OS=windows
// Note: dotenv is loaded automatically by the TestDriver SDK
const setupFiles = [
  "testdriverai/vitest/setup",
  "testdriverai/vitest/setup-aws"
];

export default defineConfig({
  test: {
    retry: 0,
    testTimeout: 900000,
    hookTimeout: 900000,
    maxConcurrency: 100,
    maxWorkers: 16,
    disableConsoleIntercept: false,
    silent: false,
    reporters: [
      "verbose",
      TestDriver()
    ],
    setupFiles,
  },
});
