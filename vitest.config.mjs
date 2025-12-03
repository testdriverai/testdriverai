import dotenv from 'dotenv';
import TestDriver from 'testdriverai/vitest';
import { defineConfig } from 'vitest/config';

// Load .env file
dotenv.config();

export default defineConfig({
  test: {
    testTimeout: 120000,
    hookTimeout: 120000,
    reporters: [
      'default',
      TestDriver({
        apiKey: process.env.TD_API_KEY,
        apiRoot: process.env.TD_API_ROOT,
      }),
    ],
    setupFiles: ['testdriverai/vitest/setup'],
  },
});
