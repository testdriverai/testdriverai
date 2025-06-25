const WebSocket = require("ws");
const config = require("./config");

class Sandbox {
  constructor() {
    this.socket = null;
    this.ps = {};
    this.heartbeat = null;
    this.connected = false;
  }

  send(message) {
    let resolvePromise;
    if (this.socket) {
      message.requestId =
        Math.random().toString(36).substring(7) + new Date().getTime();
      let p = new Promise((resolve) => {
        this.socket.send(JSON.stringify(message));
        resolvePromise = resolve;
      });
      this.ps[message.requestId] = { promise: p, resolve: resolvePromise };
      return p;
    }
  }

  async boot() {
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(
        `${config.TD_API_ROOT.replace("https://", "wss://")}`,
      );

      // handle errors
      this.socket.on("close", () => {
        console.log("Socket Closed. Check your API KEY (TD_API_KEY)");
        clearInterval(this.heartbeat);
        reject();
        this.connected = false;
        process.exit(1);
      });

      this.socket.on("error", (err) => {
        console.log("Socket Error");
        err && console.log(err);
        clearInterval(this.heartbeat);
        this.connected = false;
        throw err;
      });

      this.socket.on("open", async () => {
        this.heartbeat = setInterval(() => {
          this.send({ type: "ping" });
        }, 5000);

        this.connected = true;
        resolve(this);
      });

      this.socket.on("message", (raw) => {
        let message = JSON.parse(raw);

        if (message.error) {
          console.log("");
          console.error(message.errorMessage);
          throw new Error(message.errorMessage);
        } else {
          if (this.ps[message.requestId]) {
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
