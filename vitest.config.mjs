import TestDriver from "testdriverai/vitest";
import { defineConfig } from "vitest/config";

// Always include AWS setup - it will be a no-op unless TD_OS=windows
// Note: dotenv is loaded automatically by the TestDriver SDK
const setupFiles = [
  "testdriverai/vitest/setup",
  "testdriverai/vitest/setup-aws",
  'testdriverai/vitest/setup-disable-defender'
];

export default defineConfig({
  test: {
    testTimeout: 900000,
    hookTimeout: 900000,
    teardownTimeout: 10000, // Kill test processes that hang during cleanup after 10s
    disableConsoleIntercept: true,
    maxConcurrency: 100,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: false,
        isolate: true,
        maxForks: 5, // Limit concurrent child processes to prevent resource exhaustion
      },
    },
    forceExit: true, // Force kill child processes that don't exit cleanly (prevents zombies)
    reporters: [
      "default",
      TestDriver(),
      ["junit", { outputFile: "test-report.junit.xml" }],
    ],
    setupFiles,
  },
});
