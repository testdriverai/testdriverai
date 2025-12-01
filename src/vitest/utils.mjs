/**
 * Utility Functions for TestDriver Vitest Plugin
 * 
 * General-purpose utilities for testing with TestDriver.
 * 
 * @example
 * import { retryAsync, setupEventLogging } from 'testdriverai/vitest';
 */

/**
 * Set up detailed event logging for debugging
 * @param {TestDriver} client - TestDriver client
 */
export function setupEventLogging(client) {
  const emitter = client.getEmitter();

  // Log all events
  emitter.on("**", function (data) {
    const event = this.event;
    if (event.startsWith("log:debug")) return; // Skip debug logs
    console.log(`[EVENT] ${event}`, data || "");
  });

  // Log command lifecycle
  emitter.on("command:start", (data) => {
    console.log("🚀 Command started:", data);
  });

  emitter.on("command:success", (data) => {
    console.log("✅ Command succeeded:", data);
  });

  emitter.on("command:error", (data) => {
    console.error("❌ Command error:", data);
  });

  // Log sandbox events
  emitter.on("sandbox:connected", () => {
    console.log("🔌 Sandbox connected");
  });

  emitter.on("sandbox:authenticated", () => {
    console.log("🔐 Sandbox authenticated");
  });

  emitter.on("sandbox:error", (error) => {
    console.error("⚠️  Sandbox error:", error);
  });

  // Log SDK API calls
  emitter.on("sdk:request", (data) => {
    console.log("📤 SDK Request:", data);
  });

  emitter.on("sdk:response", (data) => {
    console.log("📥 SDK Response:", data);
  });
}

/**
 * Retry an async function with configurable attempts and delay
 * @param {Function} fn - Async function to retry
 * @param {number} retries - Number of retries (default: 3)
 * @param {number} delay - Delay between retries in ms (default: 1000)
 * @returns {Promise} Result of successful execution
 * @throws {Error} Last error if all retries fail
 * 
 * @example
 * const result = await retryAsync(
 *   () => testdriver.find("Flaky Element"),
 *   5,
 *   2000
 * );
 */
export async function retryAsync(fn, retries = 3, delay = 1000) {
  let lastError;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Wait for a condition to be true
 * @param {Function} condition - Function that returns boolean or Promise<boolean>
 * @param {object} options - Wait options
 * @param {number} options.timeout - Maximum time to wait in ms (default: 30000)
 * @param {number} options.interval - Poll interval in ms (default: 500)
 * @param {string} options.message - Error message if timeout (default: "Condition not met")
 * @returns {Promise<boolean>} True if condition met
 * @throws {Error} If timeout reached
 * 
 * @example
 * await waitFor(() => element.exists(), { timeout: 10000 });
 */
export async function waitFor(condition, options = {}) {
  const { 
    timeout = 30000, 
    interval = 500, 
    message = "Condition not met within timeout" 
  } = options;
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const result = await condition();
      if (result) {
        return true;
      }
    } catch (error) {
      // Condition threw, keep polling
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`${message} (timeout: ${timeout}ms)`);
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 * 
 * @example
 * await sleep(1000); // Wait 1 second
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a unique test ID
 * @param {string} prefix - Optional prefix for the ID
 * @returns {string} Unique ID
 */
export function generateTestId(prefix = "test") {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}
