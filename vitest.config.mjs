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
    
    globalTeardown: './testdriver/acceptance-sdk/setup/globalTeardown.mjs',
    
    // Reporter configuration
    reporters: [
      'default',
      ['junit', { outputFile: 'test-results/junit.xml' }]
    ],
    
    // Use forks for isolation, allow multiple test files
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        maxForks: 20, // Run up to X test files in parallel
      },
    },
  },
});
