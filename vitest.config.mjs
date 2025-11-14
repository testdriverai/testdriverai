import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Load environment variables from .env file
config();

export default defineConfig({
  test: {
    // Test file patterns
    include: ['**/testdriver/acceptance-sdk/*.test.mjs'],
    
    // Timeout settings
    testTimeout: 600000, // 2 minutes per test
    hookTimeout: 600000,  // 1 minute for setup/teardown
    
    // Run tests sequentially (important for sandbox resource management)
    sequence: {
      concurrent: false,
      shuffle: false,
    },
    
    // Global setup and teardown
    globalSetup: './testdriver/acceptance-sdk/setup/globalSetup.mjs',
    globalTeardown: './testdriver/acceptance-sdk/setup/globalTeardown.mjs',
    
    // Reporter configuration
    reporters: [
      'verbose',
      'junit',
      './testdriver/acceptance-sdk/setup/testResultsReporter.mjs'
    ],
    
    // Coverage configuration (optional)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['sdk.js', 'agent/**/*.js'],
    },
    
    // Use forks for isolation, allow multiple test files
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        maxForks: 3, // Run up to 3 test files in parallel
      },
    },
  },
});
