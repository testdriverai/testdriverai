const WebSocket = require("ws");
const marky = require("marky");
const crypto = require("crypto");
const { events } = require("../events");

/**
 * Generate Sentry trace headers for distributed tracing
 * Uses the same trace ID derivation as the API (MD5 hash of session ID)
 * @param {string} sessionId - The session ID
 * @returns {Object} Headers object with sentry-trace and baggage
 */
function getSentryTraceHeaders(sessionId) {
  if (!sessionId) return {};
  
  // Same logic as API: derive trace ID from session ID
  const traceId = crypto.createHash('md5').update(sessionId).digest('hex');
  const spanId = crypto.randomBytes(8).toString('hex');
  
  return {
    'sentry-trace': `${traceId}-${spanId}-1`,
    'baggage': `sentry-trace_id=${traceId},sentry-sample_rate=1.0,sentry-sampled=true`
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

      if (this.socket) {
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

        // Start timing for this message
        const timingKey = `sandbox-${message.type}`;
        marky.mark(timingKey);

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
            const pendingMessage = this.ps[requestId];
            // Stop the timing marker to prevent memory leak
            try {
              marky.stop(pendingMessage.timingKey);
            } catch (e) {
              // Ignore timing errors
            }
            delete this.ps[requestId];
            rejectPromise(new Error(`Sandbox message '${message.type}' timed out after ${timeout}ms`));
          }
        }, timeout);

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
          timingKey,
          startTime: Date.now(),
        };

        return p;
      }
      
      // Return a rejected promise if socket is not available
      return Promise.reject(new Error('Sandbox socket not connected'));
    }

    async auth(apiKey) {
      let reply = await this.send({
        type: "authenticate",
        apiKey,
      });

      if (reply.success) {
        this.authenticated = true;
        
        // Log and store the Sentry trace ID for debugging
        if (reply.traceId) {
          this.traceId = reply.traceId;
          console.log(`[Debug] View trace: https://testdriver.sentry.io/explore/traces/trace/${reply.traceId}`);
        }
        
        emitter.emit(events.sandbox.authenticated, { traceId: reply.traceId });
        return true;
      }
    }

    async connect(sandboxId, persist = false) {
      let reply = await this.send({
        type: "connect",
        persist,
        sandboxId,
      });

      if (reply.success) {
        this.instanceSocketConnected = true;
        emitter.emit(events.sandbox.connected);
        // Return the full reply (includes url and sandbox)
        return reply;
      } else {
        // Throw error to trigger fallback to creating new sandbox
        throw new Error(reply.errorMessage || "Failed to connect to sandbox");
      }
    }

    async boot(apiRoot) {
      return new Promise((resolve, reject) => {
        // Get session ID for Sentry trace headers
        const sessionId = this.sessionInstance?.get();
        
        if (!sessionId) {
          console.warn('[Sandbox] No session ID available at boot time - Sentry tracing will not be available');
        }
        
        const sentryHeaders = getSentryTraceHeaders(sessionId);

        // Build WebSocket URL with Sentry trace headers as query params
        const wsUrl = new URL(apiRoot.replace("https://", "wss://"));
        if (sentryHeaders['sentry-trace']) {
          wsUrl.searchParams.set('sentry-trace', sentryHeaders['sentry-trace']);
        }
        if (sentryHeaders['baggage']) {
          wsUrl.searchParams.set('baggage', sentryHeaders['baggage']);
        }

        this.socket = new WebSocket(wsUrl.toString());

        // handle errors
        this.socket.on("close", () => {
          clearInterval(this.heartbeat);
          // Emit a clear error event for API key issues
          reject();
          this.apiSocketConnected = false;
        });

        this.socket.on("error", (err) => {
          console.log("Socket Error");
          err && console.log(err);
          clearInterval(this.heartbeat);
          emitter.emit(events.error.sandbox, err);
          this.apiSocketConnected = false;
          throw err;
        });

        this.socket.on("open", async () => {
          this.apiSocketConnected = true;

          this.heartbeat = setInterval(() => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
              this.socket.ping();
            }
          }, 5000);

          resolve(this);
        });

        this.socket.on("message", async (raw) => {
          let message = JSON.parse(raw);

          if (!this.ps[message.requestId]) {
            console.warn(
              "No pending promise found for requestId:",
              message.requestId,
            );
            return;
          }

          if (message.error) {
            emitter.emit(events.error.sandbox, message.errorMessage);
            const error = new Error(message.errorMessage || "Sandbox error");
            error.responseData = message;
            this.ps[message.requestId].reject(error);
          } else {
            emitter.emit(events.sandbox.received);

            // Get timing information for this message
            const pendingMessage = this.ps[message.requestId];
            if (pendingMessage) {
              const timing = marky.stop(pendingMessage.timingKey);

              // Track timing for each message type
              await analytics.track("sandbox", {
                operation: pendingMessage.message.type,
                timing,
                requestId: message.requestId,
                timestamp: Date.now(),
                data: {
                  messageType: pendingMessage.message.type,
                  ...pendingMessage.message,
                },
              });
            }

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
      
      // Silently clear pending promises without rejecting
      // (rejecting causes unhandled promise rejections during cleanup)
      this.ps = {};
    }
  }

  return new Sandbox();
};

module.exports = { createSandbox };
