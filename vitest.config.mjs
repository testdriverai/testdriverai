import TestDriver from "testdriverai/vitest";
import { defineConfig } from "vitest/config";

// Always include AWS and E2B setup - they will be no-ops unless
// TD_OS=windows (AWS) or E2B_TEMPLATE is set (E2B)
// Note: dotenv is loaded automatically by the TestDriver SDK
const setupFiles = [
  "testdriverai/vitest/setup",
  "testdriverai/vitest/setup-aws",
  "testdriverai/vitest/setup-e2b"
];

export default defineConfig({
  test: {
    retry: 0,
    testTimeout: 900000,
    hookTimeout: 900000,
    disableConsoleIntercept: true,
    maxConcurrency: 100,
    maxWorkers: 16,
    reporters: [
      "default",
      TestDriver(),
      ["junit", { outputFile: "test-report.junit.xml" }],
    ],
    setupFiles,
  },
});
