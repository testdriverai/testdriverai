/**
 * Vitest Setup File for TestDriver
 *
 * This file is loaded by Vitest before each test file.
 *
 * Historical note: this file used to bridge pluginState to workers via
 * globalThis.__testdriverPlugin. That approach was removed because:
 *   - Under pool:"forks", each process gets its own module graph so the
 *     globalThis assignment was a no-op (workers couldn't see the reporter's
 *     pluginState anyway).
 *   - Under pool:"threads", modules are shared across threads, making
 *     globalThis mutations unsafe (race conditions, cross-test leaks).
 *
 * Now, worker ↔ reporter communication goes exclusively through Vitest's
 * task.meta channel (serialised per-task, safe under all pool modes).
 *
 * Usage in vitest.config.mjs:
 * ```js
 * export default defineConfig({
 *   test: {
 *     setupFiles: ['testdriverai/vitest/setup'],
 *   },
 * });
 * ```
 */

// Log that setup is complete (only in debug mode)
if (process.env.TD_LOG_LEVEL?.toLowerCase() === 'debug') {
  console.log('[TestDriver] Setup file initialized');
}
