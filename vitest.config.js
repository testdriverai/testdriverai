import { defineConfig } from 'vitest/config';
import TestDriver from 'testdriverai/vitest';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

export default defineConfig({
  test: {
    testTimeout: 300000,
    hookTimeout: 300000,
    reporters: [
      'default',
      TestDriver(),
    ],
    setupFiles: ['testdriverai/vitest/setup'],
  },
});
