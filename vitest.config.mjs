import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use projects to run tests on different OS configurations
    projects: [
      {
        name: 'windows',
        test: {
          // Test file patterns
          include: ['testdriver/acceptance-sdk/**/*.test.mjs'],
          
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
          outputFile: {
            junit: './test-results/junit-windows.xml',
          },
          
          // Coverage configuration (optional)
          coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['sdk.js', 'agent/**/*.js'],
          },
          
          // Environment - Windows OS
          env: {
            TD_API_KEY: process.env.TD_API_KEY || '',
            TD_OS: 'windows',
          },
          
          // Disable threads for consistent sandbox state
          pool: 'forks',
          poolOptions: {
            forks: {
              singleFork: true,
            },
          },
        },
      },
      {
        name: 'linux',
        test: {
          // Test file patterns
          include: ['testdriver/acceptance-sdk/**/*.test.mjs'],
          
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
          outputFile: {
            junit: './test-results/junit-linux.xml',
          },
          
          // Coverage configuration (optional)
          coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['sdk.js', 'agent/**/*.js'],
          },
          
          // Environment - Linux OS
          env: {
            TD_API_KEY: process.env.TD_API_KEY || '',
            TD_OS: 'linux',
          },
          
          // Disable threads for consistent sandbox state
          pool: 'forks',
          poolOptions: {
            forks: {
              singleFork: true,
            },
          },
        },
      },
    ],
  },
});
