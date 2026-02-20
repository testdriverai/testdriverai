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
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 10;
      this.intentionalDisconnect = false;
      this.apiRoot = null;
      this.apiKey = null;
      this.reconnectTimer = null; // Track reconnect setTimeout
      this.reconnecting = false; // Prevent duplicate reconnection attempts
      this.pendingTimeouts = new Map(); // Track per-message timeouts
      this.pendingRetryQueue = []; // Queue of requests to retry after reconnection
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
        if (this._lastConnectParams?.sandboxId && !message.sandboxId) {
          message.sandboxId = this._lastConnectParams.sandboxId;
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
          this.pendingTimeouts.delete(requestId);
          if (this.ps[requestId]) {
            delete this.ps[requestId];
            rejectPromise(
              new Error(
                `Sandbox message '${message.type}' timed out after ${timeout}ms`,
              ),
            );
          }
        }, timeout);
        // Don't let pending message timeouts prevent Node process from exiting
        // (unref is not available in browser/non-Node environments)
        if (timeoutId.unref) {
          timeoutId.unref();
        }

        // Track timeout so close() can clear it
        this.pendingTimeouts.set(requestId, timeoutId);

        this.ps[requestId] = {
          promise: p,
          resolve: (result) => {
            clearTimeout(timeoutId);
            this.pendingTimeouts.delete(requestId);
            resolvePromise(result);
          },
          reject: (error) => {
            clearTimeout(timeoutId);
            this.pendingTimeouts.delete(requestId);
            rejectPromise(error);
          },
          message,
          startTime: Date.now(),
        };

        // Fire-and-forget message types: attach .catch() to prevent
        // unhandled promise rejections if nobody awaits the result
        const fireAndForgetTypes = ["output", "trackInteraction"];
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

    async connect(sandboxId, persist = false, keepAlive = null) {
      // Store connection params so we can re-establish after reconnection
      this._lastConnectParams = { sandboxId, persist, keepAlive };

      let reply = await this.send({
        type: "connect",
        persist,
        sandboxId,
        keepAlive,
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

    async handleConnectionLoss() {
      if (this.intentionalDisconnect) return;

      // Prevent duplicate reconnection attempts (both 'error' and 'close' fire)
      if (this.reconnecting) return;
      this.reconnecting = true;

      // Remove listeners from the old socket to prevent "No pending promise found" warnings
      // when late responses arrive on the dying connection
      if (this.socket) {
        try {
          this.socket.removeAllListeners("message");
        } catch (e) {
          // Ignore errors removing listeners from closed socket
        }
      }

      // Queue pending requests for retry after reconnection
      // (they were sent on the old socket and will never receive responses)
      const pendingRequestIds = Object.keys(this.ps);
      if (pendingRequestIds.length > 0) {
        console.log(`[Sandbox] Queuing ${pendingRequestIds.length} pending request(s) for retry after reconnection`);
        for (const requestId of pendingRequestIds) {
          const pending = this.ps[requestId];
          if (pending) {
            // Clear the timeout - we'll set a new one when we retry
            const timeoutId = this.pendingTimeouts.get(requestId);
            if (timeoutId) {
              clearTimeout(timeoutId);
              this.pendingTimeouts.delete(requestId);
            }
            // Queue for retry (store message and promise handlers)
            this.pendingRetryQueue.push({
              message: pending.message,
              resolve: pending.resolve,
              reject: pending.reject,
            });
          }
        }
        this.ps = {};
      }

      // Cancel any existing reconnect timer
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        const errorMsg =
          "Unable to reconnect to TestDriver sandbox after multiple attempts. Please check your internet connection.";
        emitter.emit(events.error.sandbox, errorMsg);
        console.error(errorMsg);
        
        // Reject all queued requests since reconnection failed
        if (this.pendingRetryQueue.length > 0) {
          console.log(`[Sandbox] Rejecting ${this.pendingRetryQueue.length} queued request(s) - reconnection failed`);
          for (const queued of this.pendingRetryQueue) {
            queued.reject(new Error("Sandbox reconnection failed after multiple attempts"));
          }
          this.pendingRetryQueue = [];
        }
        
        this.reconnecting = false;
        return;
      }

      this.reconnectAttempts++;
      const delay = Math.min(1000 * 2 ** (this.reconnectAttempts - 1), 60000);

      console.log(
        `[Sandbox] Connection lost. Reconnecting in ${delay}ms... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
      );

      this.reconnectTimer = setTimeout(async () => {
        this.reconnectTimer = null;
        try {
          await this.boot(this.apiRoot);
          if (this.apiKey) {
            await this.auth(this.apiKey);
          }
          // Re-establish sandbox connection on the new API instance
          // Without this, the new API instance has no connection.desktop
          // and all Linux operations will fail with "sandbox not initialized"
          if (this._lastConnectParams) {
            const { sandboxId, persist, keepAlive } = this._lastConnectParams;
            console.log(`[Sandbox] Re-establishing sandbox connection (${sandboxId})...`);
            await this.connect(sandboxId, persist, keepAlive);
          }
          console.log("[Sandbox] Reconnected successfully.");
          
          // Retry queued requests
          await this._retryQueuedRequests();
        } catch (e) {
          // boot's close handler will trigger handleConnectionLoss again
        } finally {
          this.reconnecting = false;
        }
      }, delay);
      // Don't let the reconnect timer prevent Node process from exiting
      // (unref is not available in browser/non-Node environments)
      if (this.reconnectTimer.unref) {
        this.reconnectTimer.unref();
      }
    }

    /**
     * Retry queued requests after successful reconnection
     * @private
     */
    async _retryQueuedRequests() {
      if (this.pendingRetryQueue.length === 0) return;

      console.log(`[Sandbox] Retrying ${this.pendingRetryQueue.length} queued request(s)...`);
      
      // Take all queued requests and clear the queue
      const toRetry = this.pendingRetryQueue.splice(0);
      
      for (const queued of toRetry) {
        try {
          // Re-send the message and resolve/reject the original promise
          const result = await this.send(queued.message);
          queued.resolve(result);
        } catch (err) {
          queued.reject(err);
        }
      }
      
      console.log(`[Sandbox] Finished retrying queued requests.`);
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
          // Also mark instance socket as disconnected to prevent sending messages
          // to a closed connection (e.g., when sandbox is killed due to test failure)
          this.instanceSocketConnected = false;
          // Reset reconnecting flag so handleConnectionLoss can run for this new disconnection
          this.reconnecting = false;
          this.handleConnectionLoss();
          reject();
        });

        this.socket.on("error", (err) => {
          logger.log("Socket Error");
          err && logger.log(err);
          clearInterval(this.heartbeat);
          emitter.emit(events.error.sandbox, err);
          this.apiSocketConnected = false;
          // Don't call handleConnectionLoss here - the 'close' event always fires
          // after 'error', so let 'close' handle reconnection to avoid duplicate attempts
          reject(err);
        });

        this.socket.on("open", async () => {
          this.reconnectAttempts = 0;
          this.reconnecting = false;
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
            // This can happen during reconnection (ps was cleared) or after timeout
            // (promise was deleted). Only log at debug level since it's expected.
            if (!this.reconnecting) {
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
      this.intentionalDisconnect = true;
      this.reconnecting = false;
      // Cancel any pending reconnect timer
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      if (this.heartbeat) {
        clearInterval(this.heartbeat);
        this.heartbeat = null;
      }

      // Clear all pending message timeouts to prevent timers keeping the process alive
      for (const timeoutId of this.pendingTimeouts.values()) {
        clearTimeout(timeoutId);
      }
      this.pendingTimeouts.clear();

      if (this.socket) {
        // Remove all listeners before closing to prevent reconnect attempts
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

      // Silently clear pending promises and retry queue without rejecting
      // (rejecting causes unhandled promise rejections during cleanup)
      this.ps = {};
      this.pendingRetryQueue = [];
    }
  }

  return new Sandbox();
};

module.exports = { createSandbox };
