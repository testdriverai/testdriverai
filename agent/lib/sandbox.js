const WebSocket = require("ws");
const marky = require("marky");
const { events } = require("../events");

const createSandbox = (emitter, analytics) => {
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
      this.isBooting = false; // Add state tracking to prevent concurrent connection attempts
      this.connectionAttempts = 0; // Track connection attempts
      this.maxConnectionAttempts = 3; // Maximum connection attempts
    }

    send(message) {
      let resolvePromise;
      let rejectPromise;

      if (this.socket) {
        this.messageId++;
        message.requestId = `${this.uniqueId}-${this.messageId}`;

        // Start timing for this message
        const timingKey = `sandbox-${message.type}`;
        marky.mark(timingKey);

        let p = new Promise((resolve, reject) => {
          this.socket.send(JSON.stringify(message));
          emitter.emit(events.sandbox.sent, message);
          resolvePromise = resolve;
          rejectPromise = reject;
        });

        this.ps[message.requestId] = {
          promise: p,
          resolve: resolvePromise,
          reject: rejectPromise,
          message,
          timingKey,
          startTime: Date.now(),
        };

        return p;
      }
    }

    async auth(apiKey) {
      let reply = await this.send({
        type: "authenticate",
        apiKey,
      });

      if (reply.success) {
        this.authenticated = true;
        emitter.emit(events.sandbox.authenticated);
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
      }

      return reply.sandbox;
    }

    async boot(apiRoot) {
      // Prevent concurrent boot attempts
      if (this.isBooting) {
        throw new Error("Connection attempt already in progress");
      }

      // Check if we've exceeded maximum connection attempts
      if (this.connectionAttempts >= this.maxConnectionAttempts) {
        throw new Error(`Maximum connection attempts (${this.maxConnectionAttempts}) exceeded`);
      }

      this.isBooting = true;
      this.connectionAttempts++;

      return new Promise((resolve, reject) => {
        // Cleanup function to prevent memory leaks and connection loops
        const cleanup = () => {
          this.isBooting = false;
          if (this.heartbeat) {
            clearInterval(this.heartbeat);
            this.heartbeat = null;
          }
          this.apiSocketConnected = false;
        };

        // Add timeout to prevent hanging connections
        const connectionTimeout = setTimeout(() => {
          cleanup();
          if (this.socket) {
            this.socket.terminate();
          }
          reject(new Error("Connection timeout"));
        }, 10000); // 10 second timeout

        try {
          this.socket = new WebSocket(apiRoot.replace("https://", "wss://"));

          // Handle connection close
          this.socket.on("close", () => {
            clearTimeout(connectionTimeout);
            cleanup();
            reject(new Error("WebSocket connection closed"));
          });

          // Handle connection errors
          this.socket.on("error", (err) => {
            clearTimeout(connectionTimeout);
            cleanup();
            emitter.emit(events.error.sandbox, err);
            reject(err); // Use reject instead of throw to prevent uncaught exceptions
          });

          // Handle successful connection
          this.socket.on("open", async () => {
            clearTimeout(connectionTimeout);
            this.apiSocketConnected = true;
            this.isBooting = false;
            
            // Reset connection attempts on successful connection
            this.connectionAttempts = 0;

            // Set up heartbeat with proper cleanup tracking
            this.heartbeat = setInterval(() => {
              if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.ping();
              }
            }, 5000);

            resolve(this);
          });

          // Handle messages
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
              this.ps[message.requestId].reject(JSON.stringify(message));
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
        } catch (error) {
          clearTimeout(connectionTimeout);
          cleanup();
          reject(error);
        }
      });
    }

    // Add cleanup method to properly disconnect and clean up resources
    cleanup() {
      this.isBooting = false;
      this.apiSocketConnected = false;
      this.instanceSocketConnected = false;
      this.authenticated = false;
      
      if (this.heartbeat) {
        clearInterval(this.heartbeat);
        this.heartbeat = null;
      }

      if (this.socket) {
        this.socket.removeAllListeners();
        if (this.socket.readyState === WebSocket.OPEN) {
          this.socket.close();
        }
        this.socket = null;
      }

      // Reject any pending promises to prevent hanging
      Object.values(this.ps).forEach((pendingRequest) => {
        if (pendingRequest && typeof pendingRequest.reject === 'function') {
          pendingRequest.reject(new Error("Connection closed"));
        }
      });
      this.ps = {};
    }
  }

  return new Sandbox();
};

module.exports = { createSandbox };
