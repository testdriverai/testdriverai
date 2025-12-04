import { config } from 'dotenv';
import TestDriver from 'testdriverai/vitest';
import { defineConfig } from 'vitest/config';

// Load .env file early so it's available to the reporter (runs in main process)
// and to worker processes
config();

export default defineConfig({
  test: {
    testTimeout: 300000,
    hookTimeout: 300000,
    reporters: [
      'default',
      // Don't pass apiKey/apiRoot here - they'll be read from env at runtime
      TestDriver(),
    ],
    setupFiles: ['testdriverai/vitest/setup'],
  },
});
