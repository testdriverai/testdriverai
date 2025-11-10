import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test file patterns
    include: ['testdriver/acceptance-sdk/**/*.test.mjs'],
    
    // Timeout settings
    testTimeout: 120000, // 2 minutes per test
    hookTimeout: 60000,  // 1 minute for setup/teardown
    
    // Run tests sequentially (important for sandbox resource management)
    sequence: {
      concurrent: false,
      shuffle: false,
    },
    
    // Global setup and teardown
    globalSetup: './testdriver/acceptance-sdk/setup/globalSetup.mjs',
    
    // Reporter configuration
    reporters: ['verbose', 'junit'],
    outputFile: {
      junit: './test-results/junit.xml',
    },
    
    // Coverage configuration (optional)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['sdk.js', 'agent/**/*.js'],
    },
    
    // Environment
    env: {
      TD_API_KEY: process.env.TD_API_KEY || '',
    },
    
    // Disable threads for consistent sandbox state
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
