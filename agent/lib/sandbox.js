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
      return new Promise((resolve, reject) => {
        this.socket = new WebSocket(apiRoot.replace("https://", "wss://"));

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

          setInterval(() => {
            if (this.socket.readyState === WebSocket.OPEN) {
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
      });
    }
  }

  return new Sandbox();
};

module.exports = { createSandbox };
