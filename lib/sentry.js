/**
 * Sentry initialization for TestDriver CLI
 *
 * This module initializes Sentry for error tracking and performance monitoring.
 * It should be required at the very beginning of the CLI entry point.
 *
 * Distributed Tracing:
 * The CLI uses session-based trace IDs (MD5 hash of session ID) to link
 * CLI traces with API traces. Call setSessionTraceContext() after establishing
 * a session to ensure all CLI errors/logs are linked to the same trace.
 */

const Sentry = require("@sentry/node");
const crypto = require("crypto");
const os = require("os");
const { version } = require("../package.json");

// Store the current session's trace context
let currentTraceId = null;
let currentSessionId = null;

// Track if we've attached listeners to avoid duplicates
let emitterAttached = false;

const isEnabled = () => {
  // Disable if explicitly disabled
  if (process.env.TD_TELEMETRY === "false") {
    return false;
  }
  return true;
};

if (isEnabled()) {
  console.log("Analytics enabled. Set TD_TELEMETRY=false to disable.");
  Sentry.init({
    dsn:
      process.env.SENTRY_DSN ||
      "https://452bd5a00dbd83a38ee8813e11c57694@o4510262629236736.ingest.us.sentry.io/4510480443637760",
    environment: "sdk",
    release: `testdriverai@${version}`,
    sampleRate: 1.0,
    tracesSampleRate: 1.0, // Sample 20% of transactions for performance
    enableLogs: true,
    integrations: [Sentry.httpIntegration(), Sentry.nodeContextIntegration()],
    // Set initial context
    initialScope: {
      tags: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
      },
    },
    // Filter out common non-errors
    beforeSend(event, hint) {
      const error = hint.originalException;

      // Don't send user-initiated exits
      if (error && error.message && error.message.includes("User cancelled")) {
        return null;
      }

      return event;
    },
  });
}

/**
 * Set user context for Sentry
 * @param {Object} user - User object with id, email, etc.
 */
function setUser(user) {
  if (!isEnabled()) return;
  Sentry.setUser(user);
}

/**
 * Set additional context
 * @param {string} name - Context name
 * @param {Object} context - Context data
 */
function setContext(name, context) {
  if (!isEnabled()) return;
  Sentry.setContext(name, context);
}

/**
 * Set a tag
 * @param {string} key - Tag key
 * @param {string} value - Tag value
 */
function setTag(key, value) {
  if (!isEnabled()) return;
  Sentry.setTag(key, value);
}

/**
 * Capture an exception
 * @param {Error} error - The error to capture
 * @param {Object} context - Additional context
 */
function captureException(error, context = {}) {
  if (!isEnabled()) return;

  Sentry.withScope((scope) => {
    // Link to session trace if available
    if (currentTraceId && currentSessionId) {
      scope.setTag("session", currentSessionId);
      scope.setContext("trace", {
        trace_id: currentTraceId,
        session_id: currentSessionId,
      });
    }

    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }
    if (context.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
}

/**
 * Capture a message
 * @param {string} message - The message to capture
 * @param {string} level - Severity level (info, warning, error)
 */
function captureMessage(message, level = "info") {
  if (!isEnabled()) return;

  Sentry.withScope((scope) => {
    // Link to session trace if available
    if (currentTraceId && currentSessionId) {
      scope.setTag("session", currentSessionId);
      scope.setContext("trace", {
        trace_id: currentTraceId,
        session_id: currentSessionId,
      });
    }
    Sentry.captureMessage(message, level);
  });
}

/**
 * Set the session trace context for distributed tracing
 * This links CLI errors/logs to the same trace as API calls
 * @param {string} sessionId - The session ID
 */
function setSessionTraceContext(sessionId) {
  if (!isEnabled() || !sessionId) return;

  // Derive trace ID from session ID (same algorithm as API)
  currentTraceId = crypto.createHash("md5").update(sessionId).digest("hex");
  currentSessionId = sessionId;

  // Set as global tag so all events include it
  Sentry.setTag("session", sessionId);
  Sentry.setTag("trace_id", currentTraceId);

  // Try to set propagation context for trace linking (may not be available in all versions)
  try {
    const scope = Sentry.getCurrentScope();
    if (scope && typeof scope.setPropagationContext === "function") {
      scope.setPropagationContext({
        traceId: currentTraceId,
        spanId: currentTraceId.substring(0, 16),
        sampled: true,
      });
    }
  } catch (e) {
    // Ignore errors - propagation context may not be supported
    console.log("Could not set propagation context:", e.message);
  }
}

/**
 * Clear the session trace context
 */
function clearSessionTraceContext() {
  currentTraceId = null;
  currentSessionId = null;
}

/**
 * Get the current trace ID (for debugging)
 * @returns {string|null} Current trace ID or null
 */
function getTraceId() {
  return currentTraceId;
}

/**
 * Attach log listeners to an emitter to capture CLI logs as Sentry breadcrumbs
 * @param {EventEmitter} emitter - The event emitter to listen to
 */
function attachLogListeners(emitter) {
  if (!isEnabled() || !emitter || emitterAttached) return;

  // Check if Sentry.logger is available
  if (!Sentry.logger) {
    console.log("Sentry.logger not available, skipping log listeners");
    return;
  }

  emitterAttached = true;

  // Helper to strip ANSI codes for cleaner logs
  const stripAnsi = (str) => {
    if (typeof str !== "string") return String(str);
    return str.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, "");
  };

  // Helper to get current log attributes with trace context
  const getLogAttributes = (extra = {}) => {
    const attrs = { ...extra };
    if (currentSessionId) {
      attrs["session.id"] = currentSessionId;
    }
    if (currentTraceId) {
      attrs["sentry.trace.trace_id"] = currentTraceId;
    }
    // Get current user from Sentry scope
    try {
      const user = Sentry.getCurrentScope().getUser();
      if (user) {
        if (user.id) attrs["user.id"] = user.id;
        if (user.email) attrs["user.email"] = user.email;
        if (user.username) attrs["user.name"] = user.username;
      }
    } catch (e) {
      // Ignore errors getting user
    }
    return attrs;
  };

  // Capture log:log as info logs
  emitter.on("log:log", (message) => {
    Sentry.logger.info(
      stripAnsi(message),
      getLogAttributes({ category: "cli.log" }),
    );
  });

  // Capture log:warn as warning logs
  emitter.on("log:warn", (message) => {
    Sentry.logger.warn(
      stripAnsi(message),
      getLogAttributes({ category: "cli.warn" }),
    );
  });

  // Capture log:debug as debug logs (only in verbose mode)
  if (process.env.VERBOSE || process.env.DEBUG || process.env.TD_DEBUG) {
    emitter.on("log:debug", (message) => {
      Sentry.logger.debug(
        stripAnsi(message),
        getLogAttributes({ category: "cli.debug" }),
      );
    });
  }

  // Capture command events
  emitter.on("command:start", (data) => {
    Sentry.logger.info(
      `Command started: ${data?.command || data?.name || "unknown"}`,
      getLogAttributes({
        category: "cli.command",
        ...data,
      }),
    );
  });

  emitter.on("command:error", (data) => {
    Sentry.logger.error(
      `Command error: ${data?.message || data?.error || "unknown"}`,
      getLogAttributes({
        category: "cli.command",
        ...data,
      }),
    );
  });

  // Capture step events
  emitter.on("step:start", (data) => {
    Sentry.logger.info(
      `Step started: ${data?.step || data?.name || "unknown"}`,
      getLogAttributes({
        category: "cli.step",
      }),
    );
  });

  emitter.on("step:error", (data) => {
    Sentry.logger.error(
      `Step error: ${data?.message || data?.error || "unknown"}`,
      getLogAttributes({
        category: "cli.step",
        ...data,
      }),
    );
  });

  // Capture test events
  emitter.on("test:start", (data) => {
    Sentry.logger.info(
      `Test started: ${data?.name || "unknown"}`,
      getLogAttributes({
        category: "cli.test",
      }),
    );
  });

  emitter.on("test:error", (data) => {
    Sentry.logger.error(
      `Test error: ${data?.message || data?.error || "unknown"}`,
      getLogAttributes({
        category: "cli.test",
        ...data,
      }),
    );
  });
}

/**
 * Start a new transaction for performance monitoring
 * @param {string} name - Transaction name
 * @param {string} op - Operation type
 * @returns {Object} Transaction object
 */
function startTransaction(name, op = "cli") {
  if (!isEnabled()) return null;
  return Sentry.startSpan({ name, op });
}

/**
 * Flush pending events before process exit
 * @param {number} timeout - Timeout in milliseconds
 */
async function flush(timeout = 2000) {
  if (!isEnabled()) return;
  await Sentry.flush(timeout);
}

module.exports = {
  Sentry,
  isEnabled,
  setUser,
  setContext,
  setTag,
  captureException,
  captureMessage,
  setSessionTraceContext,
  clearSessionTraceContext,
  getTraceId,
  attachLogListeners,
  startTransaction,
  flush,
};
