const WebSocket = require("ws");
const crypto = require("crypto");
const { events } = require("../events");
const logger = require("./logger");
const { version } = require("../../package.json");

/**
 * Generate Sentry trace headers for distributed tracing
 * Uses the same trace ID derivation as the API (MD5 hash of session ID)
 * @param {string} sessionId - The session ID
 * @returns {Object} Headers object with sentry-trace and baggage
 */
function getSentryTraceHeaders(sessionId) {
  if (!sessionId) return {};

  // Same logic as API: derive trace ID from session ID
  const traceId = crypto.createHash("md5").update(sessionId).digest("hex");
  const spanId = crypto.randomBytes(8).toString("hex");

  return {
    "sentry-trace": `${traceId}-${spanId}-1`,
    baggage: `sentry-trace_id=${traceId},sentry-sample_rate=1.0,sentry-sampled=true`,
  };
}

const createSandbox = (emitter, analytics, sessionInstance) => {
  class Sandbox {
    constructor() {
      this.socket = null;
      this.ps = {};
      this.heartbeat = null;
      this.apiSocketConnected = false;
      this.instanceSocketConnected = false;
      this.authenticated = false;
      this.instance = null;
      this.messageId = 0;
      this.uniqueId = Math.random().toString(36).substring(7);
      this.os = null; // Store OS value to send with every message
      this.sessionInstance = sessionInstance; // Store session instance to include in messages
      this.traceId = null; // Sentry trace ID for debugging
      this.apiRoot = null;
      this.apiKey = null;
      this._lastConnectParams = null; // Connection params for sandboxId injection
    }

    /**
     * Get the Sentry trace ID for this session
     * Useful for debugging with customers - they can share this ID to look up their traces
     * @returns {string|null} The trace ID or null if not authenticated
     */
    getTraceId() {
      return this.traceId;
    }

    /**
     * Get the Sentry trace URL for this session
     * @returns {string|null} The full Sentry trace URL or null if no trace ID
     */
    getTraceUrl() {
      if (!this.traceId) return null;
      return `https://testdriver.sentry.io/explore/traces/trace/${this.traceId}`;
    }

    send(message, timeout = 300000) {
      let resolvePromise;
      let rejectPromise;

      // Check if socket exists and is actually open before sending
      // This prevents sending to a closed connection (e.g., sandbox killed due to test failure)
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.messageId++;
        message.requestId = `${this.uniqueId}-${this.messageId}`;

        // If os is set in the message, store it for future messages
        if (message.os) {
          this.os = message.os;
        }

        // Add os to every message if it's been set
        if (this.os && !message.os) {
          message.os = this.os;
        }

        // Add session to every message if available (for interaction tracking)
        if (this.sessionInstance && !message.session) {
          const sessionId = this.sessionInstance.get();
          if (sessionId) {
            message.session = sessionId;
          }
        }

        // Add sandboxId to every message if we have a connected sandbox
        // This allows the API to reconnect if the connection was rerouted
        // Don't inject IP addresses as sandboxId — only valid instance/sandbox IDs
        if (this._lastConnectParams?.sandboxId && !message.sandboxId) { 
          const id = this._lastConnectParams.sandboxId;
          // Only inject if it looks like a valid ID (not an IP address)
          if (id && !/^\d+\.\d+\.\d+\.\d+$/.test(id)) {
            message.sandboxId = id;
          }
        }

        let p = new Promise((resolve, reject) => {
          this.socket.send(JSON.stringify(message));
          emitter.emit(events.sandbox.sent, message);
          resolvePromise = resolve;
          rejectPromise = reject;
        });

        const requestId = message.requestId;

        // Set up timeout to prevent hanging requests
        const timeoutId = setTimeout(() => {
          if (this.ps[requestId]) {
            delete this.ps[requestId];
            rejectPromise(
              new Error(
                `Sandbox message '${message.type}' timed out after ${timeout}ms`,
              ),
            );
          }
        }, timeout);
        // Don't let pending timeouts prevent Node process from exiting
        if (timeoutId.unref) {
          timeoutId.unref();
        }

        this.ps[requestId] = {
          promise: p,
          resolve: (result) => {
            clearTimeout(timeoutId);
            resolvePromise(result);
          },
          reject: (error) => {
            clearTimeout(timeoutId);
            rejectPromise(error);
          },
          message,
          startTime: Date.now(),
        };

        // Fire-and-forget message types: attach .catch() to prevent
        // unhandled promise rejections if nobody awaits the result
        const fireAndForgetTypes = ["output"];
        if (fireAndForgetTypes.includes(message.type)) {
          p.catch(() => {});
        }

        return p;
      }

      // Return a rejected promise if socket is not available or not open
      // This can happen when the sandbox is killed (e.g., due to test failure)
      const state = this.socket?.readyState;
      const stateMap = {
        [WebSocket.CONNECTING]: "connecting",
        [WebSocket.CLOSING]: "closing",
        [WebSocket.CLOSED]: "closed",
      };
      const stateDesc = stateMap[state] || "unavailable";
      return Promise.reject(new Error(`Sandbox socket not connected (state: ${stateDesc})`));
    }

    async auth(apiKey) {
      this.apiKey = apiKey;
      let reply = await this.send({
        type: "authenticate",
        apiKey,
        version,
      });

      if (reply.success) {
        this.authenticated = true;

        // Log and store the Sentry trace ID for debugging
        if (reply.traceId) {
          this.traceId = reply.traceId;
          logger.log('');
          logger.log(`🔗 Trace Report (Share When Reporting Bugs):`);
          logger.log(`https://testdriver.sentry.io/explore/traces/trace/${reply.traceId}`);
        }

        emitter.emit(events.sandbox.authenticated, { traceId: reply.traceId });
        return true;
      }
    }

    /**
     * Set connection params for sandboxId injection.
     * @param {Object|null} params
     * @param {string} [params.sandboxId] - Sandbox/instance ID
     */
    setConnectionParams(params) {
      this._lastConnectParams = params ? { ...params } : null;
    }

    async connect(sandboxId, persist = false, keepAlive = null) {
      let reply = await this.send({
        type: "connect",
        persist,
        sandboxId,
        keepAlive,
      });

      if (reply.success) {
        // Only store connection params after successful connection
        // This prevents malformed sandboxId from being attached to subsequent messages
        this.setConnectionParams({ sandboxId, persist, keepAlive });
        this.instanceSocketConnected = true;
        emitter.emit(events.sandbox.connected);
        // Return the full reply (includes url and sandbox)
        return reply;
      } else {
        // Clear any previous connection params on failure
        this.setConnectionParams(null);
        // Throw error to trigger fallback to creating new sandbox
        throw new Error(reply.errorMessage || "Failed to connect to sandbox");
      }
    }

    async boot(apiRoot) {
      if (apiRoot) this.apiRoot = apiRoot;
      return new Promise((resolve, reject) => {
        // Get session ID for Sentry trace headers
        const sessionId = this.sessionInstance?.get();

        if (!sessionId) {
          console.warn(
            "[Sandbox] No session ID available at boot time - Sentry tracing will not be available",
          );
        }

        const sentryHeaders = getSentryTraceHeaders(sessionId);

        // Build WebSocket URL with Sentry trace headers as query params
        const wsUrl = new URL(apiRoot.replace("https://", "wss://"));
        if (sentryHeaders["sentry-trace"]) {
          wsUrl.searchParams.set("sentry-trace", sentryHeaders["sentry-trace"]);
        }
        if (sentryHeaders["baggage"]) {
          wsUrl.searchParams.set("baggage", sentryHeaders["baggage"]);
        }

        this.socket = new WebSocket(wsUrl.toString());

        // handle errors
        this.socket.on("close", () => {
          clearInterval(this.heartbeat);
          this.apiSocketConnected = false;
          this.instanceSocketConnected = false;
          reject();
        });

        this.socket.on("error", (err) => {
          logger.log("Socket Error");
          err && logger.log(err);
          clearInterval(this.heartbeat);
          emitter.emit(events.error.sandbox, err);
          this.apiSocketConnected = false;
          reject(err);
        });

        this.socket.on("open", async () => {
          this.apiSocketConnected = true;

          this.heartbeat = setInterval(() => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
              this.socket.ping();
            }
          }, 5000);
          // Don't let the heartbeat interval prevent Node process from exiting
          if (this.heartbeat.unref) {
            this.heartbeat.unref();
          }

          resolve(this);
        });

        this.socket.on("message", async (raw) => {
          let message = JSON.parse(raw);

          // Handle progress messages (no requestId needed)
          if (message.type === "sandbox.progress") {
            emitter.emit(events.sandbox.progress, {
              step: message.step,
              message: message.message,
            });
            return;
          }

          if (!this.ps[message.requestId]) {
            // Can happen after timeout (promise was deleted). Expected during
            // polling loops where short-timeout exec calls regularly expire
            // before the sandbox responds. Only log in debug/verbose mode.
            const debugMode = process.env.VERBOSE || process.env.DEBUG || process.env.TD_DEBUG;
            if (debugMode) {
              console.warn(
                "No pending promise found for requestId:",
                message.requestId,
              );
            }
            return;
          }

          if (message.error) {
            // Don't emit error:sandbox for output (log forwarding) messages
            // to prevent infinite loops: error → log → sendToSandbox → error → ...
            const pendingMessage = this.ps[message.requestId]?.message;
            if (pendingMessage?.type !== "output") {
              emitter.emit(events.error.sandbox, message.errorMessage);
            }
            const error = new Error(message.errorMessage || "Sandbox error");
            error.responseData = message;
            this.ps[message.requestId].reject(error);
          } else {
            emitter.emit(events.sandbox.received);
            this.ps[message.requestId]?.resolve(message);
          }
          delete this.ps[message.requestId];
        });
      });
    }

    /**
     * Close the WebSocket connection and clean up resources
     */
    close() {
      if (this.heartbeat) {
        clearInterval(this.heartbeat);
        this.heartbeat = null;
      }

      if (this.socket) {
        this.socket.removeAllListeners();
        try {
          this.socket.close();
        } catch (err) {
          // Ignore close errors
        }
        this.socket = null;
      }

      this.apiSocketConnected = false;
      this.instanceSocketConnected = false;
      this.authenticated = false;
      this.instance = null;
      this._lastConnectParams = null;
      this.ps = {};
    }
  }

  return new Sandbox();
};

module.exports = { createSandbox };
