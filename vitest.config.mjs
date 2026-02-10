import TestDriver from "testdriverai/vitest";
import { defineConfig } from "vitest/config";

// Always include AWS setup - it will be a no-op unless TD_OS=windows
// Note: dotenv is loaded automatically by the TestDriver SDK
const setupFiles = [
  "testdriverai/vitest/setup",
  "testdriverai/vitest/setup-aws",
];

export default defineConfig({
  test: {
    testTimeout: 900000,
    hookTimeout: 900000,
    disableConsoleIntercept: true,
    maxConcurrency: 100,
    reporters: [
      "default",
      TestDriver(),
      ["junit", { outputFile: "test-report.junit.xml" }],
    ],
    setupFiles,
  },
});
