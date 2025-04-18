const { EventEmitter } = require("events");
const { default: nodeIPC } = require("node-ipc");
const { IPC } = nodeIPC;

class IPCServerSingleton extends EventEmitter {
  ipc = new IPC();
  interactive = false;

  /**
   * @type {Map<string, Function[]>}
   */
  eventListeners;

  constructor() {
    if (!IPCServerSingleton.instance) {
      super();
      this.ipc = new IPC();
      this.eventListeners = new Map();

      this.ipc.config.id = `testdriverai_${process.pid}`;
      this.ipc.config.retry = 50;
      this.ipc.config.silent = true;

      this.ipc.serve(() => {
        this.ipc.server.on("connect", (socket) => {
          this.ipc.server.emit(socket, "interactive", this.interactive);
        });

        this.ipc.server.on("message", ({ event, data }) => {
          this.emit(event, data);
        });
      });

      this.ipc.server.start();

      IPCServerSingleton.instance = this;
    }
    return IPCServerSingleton.instance;
  }

  broadcast(event, data) {
    if (event === "interactive") {
      this.interactive = data;
    }
    this.ipc.server.broadcast("message", { event, data });
  }
}

const server = new IPCServerSingleton();
module.exports = { server };
