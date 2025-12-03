import TestDriver from 'testdriverai/vitest';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 120000,
    hookTimeout: 120000,
    reporters: [
      'default',
      // Don't pass apiKey/apiRoot here - they'll be read from env at runtime
      TestDriver(),
    ],
    setupFiles: ['testdriverai/vitest/setup'],
  },
});
