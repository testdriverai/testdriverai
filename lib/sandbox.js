const WebSocket = require("ws");
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
      return true;
    }
  }

  async connect(sandboxId) {
    let reply = await this.send({
      type: "connect",
      sandboxId: sandboxId,
    });

    console.log("connected reply");
    console.log(reply);

    if (reply.success) {
      this.instanceSocketConnected = true;
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
        process.exit(1);
      });

      this.socket.on("error", (err) => {
        console.log("Socket Error");
        err && console.log(err);
        clearInterval(this.heartbeat);
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
          console.log("");
          console.error(message.errorMessage);
          console.error(JSON.stringify(message, null, 2));
          throw new Error(message);
        } else {
          if (this.ps[message.requestId]) {
            // console.log("=======");
            // console.log("resolving", this.ps[message.requestId]);
            // console.log("with", message);

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

const sandboxInstance = new Sandbox();
module.exports = sandboxInstance;
