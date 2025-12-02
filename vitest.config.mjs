import dotenv from 'dotenv';
import TestDriver from 'testdriverai/vitest';
import { defineConfig } from 'vitest/config';

// Load .env file
dotenv.config();

export default defineConfig({
  plugins: [TestDriver()],
  test: {
    testTimeout: 120000,
    hookTimeout: 120000,
  },
});
