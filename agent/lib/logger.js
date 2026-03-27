/**
 * Logger utility for TestDriver
 * 
 * By default, outputs to stdout (console.log).
 * When TD_STDIO=stderr is set, outputs to stderr (console.error).
 * This is necessary for MCP servers which use stdout exclusively for JSON-RPC.
 */

const useStderr = process.env.TD_STDIO === 'stderr';
const isDebug = process.env.TD_DEBUG === 'true' || process.env.VERBOSE === 'true';

/**
 * Log a message - uses stdout by default, stderr if TD_STDIO=stderr
 * @param {...any} args - Arguments to log
 */
function log(...args) {
  if (useStderr) {
    console.error(...args);
  } else {
    console.log(...args);
  }
}

/**
 * Log an error - always uses stderr
 * @param {...any} args - Arguments to log
 */
function error(...args) {
  console.error(...args);
}

/**
 * Log a warning - uses stdout by default, stderr if TD_STDIO=stderr
 * @param {...any} args - Arguments to log
 */
function warn(...args) {
  if (useStderr) {
    console.error(...args);
  } else {
    console.warn(...args);
  }
}

/**
 * Log a debug message - only outputs when DEBUG=true
 * @param {...any} args - Arguments to log
 */
function debug(...args) {
  if (!isDebug) return;
  if (useStderr) {
    console.error(...args);
  } else {
    console.log(...args);
  }
}

/**
 * Check if logger is configured to use stderr
 * @returns {boolean}
 */
function isStderrMode() {
  return useStderr;
}

module.exports = {
  log,
  debug,
  error,
  warn,
  isStderrMode,
};
