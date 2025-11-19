import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Load environment variables from .env file
config();

export default defineConfig({
  test: {
    // Test file patterns
    include: ["**/testdriver/acceptance-sdk/*.test.mjs"],

    // Timeout settings
    testTimeout: 600000, // 2 minutes per test
    hookTimeout: 600000, // 1 minute for setup/teardown

    globalTeardown: "./testdriver/acceptance-sdk/setup/globalTeardown.mjs",

    // Reporter configuration
    reporters: [
      "verbose", // Detailed console output with full logs
      ["junit", { outputFile: "test-results/junit.xml" }],
      ["json", { outputFile: "test-results/results.json" }],
      ["html", { outputFile: "test-results/index.html" }],
    ],

    // Use forks for isolation, run tests in parallel
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: false,
        maxForks: 10, // Run up to 10 tests in parallel
      },
    },

    // Enable parallel execution
    sequence: {
      concurrent: true,
      shuffle: false,
    },

    fileParallelism: true,
    maxConcurrency: 10,
  },
});
