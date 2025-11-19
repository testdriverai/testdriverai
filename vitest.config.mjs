import { config } from "dotenv";
import { defineConfig } from "vitest/config";
import testDriverPlugin from "./interfaces/vitest-plugin.mjs";

// Load environment variables from .env file
config();

export default defineConfig({
  plugins: [
    testDriverPlugin({
      apiKey: process.env.TD_API_KEY,
      apiRoot:
        process.env.TD_API_KEY_ROOT ||
        "https://testdriver-api.onrender.com",
    }),
  ],

  test: {
    // Test file patterns
    include: ["**/testdriver/acceptance-sdk/*.test.mjs"],

    // Setup file to initialize plugin in worker processes
    setupFiles: ["./testdriver/acceptance-sdk/setup/vitestSetup.mjs"],

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
      [
        "./interfaces/vitest-plugin.mjs",
        {
          apiKey: process.env.TD_API_KEY,
          apiRoot:
            process.env.TD_API_KEY_ROOT ||
            "https://testdriver-api.onrender.com",
        },
      ], // TestDriver test recording
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
