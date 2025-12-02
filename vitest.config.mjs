import { config } from "dotenv";
import { defineConfig } from "vitest/config";
import testDriverPlugin from "./interfaces/vitest-plugin.mjs";

// Load environment variables from .env file
config();

export default defineConfig({
  plugins: [
    testDriverPlugin({
      apiKey: process.env.TD_API_KEY,
      apiRoot: process.env.TD_API_ROOT || "https://testdriver-api.onrender.com",
      newSandbox: true,
    }),
  ],

  test: {
    // Test file patterns
    include: ["**/testdriver/acceptance-sdk/*.test.mjs"],

    // Setup file to initialize plugin in worker processes
    setupFiles: ["./testdriver/acceptance-sdk/setup/vitestSetup.mjs"],

    // Timeout settings
    testTimeout: 600000, // 10 minutes per test
    hookTimeout: 600000, // 10 minutes for setup/teardown
    teardownTimeout: 120000, // 2 minutes for teardown specifically

    globalTeardown: "./testdriver/acceptance-sdk/setup/globalTeardown.mjs",

    // Reporter configuration
    reporters: [
      "verbose", // Detailed console output with full logs
      ["junit", { outputFile: "test-results/junit.xml" }],
      ["json", { outputFile: "test-results/results.json" }],
      ["html", { outputFile: "test-results/index.html" }],
      [
        "./interfaces/vitest-plugin.mjs",
        {
          apiKey: process.env.TD_API_KEY,
          apiRoot:
            process.env.TD_API_ROOT || "https://testdriver-api.onrender.com",
        },
      ], // TestDriver test recording
    ],

    // Use forks for isolation, run tests in parallel
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: false,
        maxForks: 10,
        minForks: 1,
      },
    },

    // Run test files in parallel, but tests within each file sequentially
    // This prevents resource conflicts when multiple tests in the same file
    // try to connect to sandboxes simultaneously
    sequence: {
      concurrent: false, // Changed from true - run tests within files sequentially
      shuffle: false,
    },

    fileParallelism: true, // Keep file parallelism enabled
    maxConcurrency: 5, // Reduced from 10 to match maxForks
  },
});
