import { defineConfig } from 'vitest/config';
import TestDriver from 'testdriverai/vitest';

export default defineConfig({
  plugins: [TestDriver()],
  test: {
    testTimeout: 120000,
    hookTimeout: 120000,
  },
});
