const WebSocket = require("ws");
const { events } = require("../events");

const createSandbox = (emitter) => {
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

      if (this.socket) {
        this.messageId++;
        message.requestId = `${this.uniqueId}-${this.messageId}`;

        let p = new Promise((resolve) => {
          this.socket.send(JSON.stringify(message));
          emitter.emit(events.sandbox.sent, message);
          resolvePromise = resolve;
        });

        this.ps[message.requestId] = {
          promise: p,
          resolve: resolvePromise,
          message,
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

    async connect(sandboxId) {
      let reply = await this.send({
        type: "connect",
        sandboxId: sandboxId,
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
          console.log("Socket Closed. Check your API KEY (TD_API_KEY)");
          clearInterval(this.heartbeat);
          reject();
          this.apiSocketConnected = false;
          emitter.emit(events.exit, 1);
        });

        this.socket.on("error", (err) => {
          console.log("Socket Error");
          err && console.log(err);
          clearInterval(this.heartbeat);
          emitter.emit(events.sandbox.errored, err);
          this.apiSocketConnected = false;
          throw err;
        });

        this.socket.on("open", async () => {
          this.heartbeat = setInterval(() => {
            this.send({ type: "ping" });
          }, 5000);

          this.apiSocketConnected = true;
          resolve(this);
        });

        this.socket.on("message", (raw) => {
          let message = JSON.parse(raw);

          if (message.error) {
            emitter.emit(events.sandbox.error, message.errorMessage);

            console.error("Sandbox Error:", message.errorMessage);
            throw new Error(JSON.stringify(message));
          } else {
            if (this.ps[message.requestId]) {
              emitter.emit(events.sandbox.received);
              this.ps[message.requestId].resolve(message);
              delete this.ps[message.requestId];
            } else {
              console.log("unhandled message", message);
            }
          }
        });
      });
    }
  }

  return new Sandbox();
};

module.exports = { createSandbox };
