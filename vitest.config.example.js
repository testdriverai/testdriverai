import { defineConfig } from 'vitest/config';
import { TestDriverReporter } from './interfaces/vitest-reporter.js';

export default defineConfig({
  test: {
    // Add TestDriver reporter alongside default reporter
    reporters: ['default', new TestDriverReporter()],
    
    // Optional: Configure test timeout
    testTimeout: 30000,
    
    // Optional: Configure hooks timeout
    hookTimeout: 30000,
  },
});
