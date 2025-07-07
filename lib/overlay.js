const path = require("path");
const { fork } = require("child_process");
const { logger } = require("./logger.js");
const { emitter, eventsArray } = require("./events.js");

module.exports.createOverlayProcess = ({ id, detached = false } = {}) => {
  let electronProcess;
  try {
    // Resolve the path to Electron CLI
    const electronCliPath = require.resolve("electron/cli.js");

    // Construct the path to the overlay.js script
    const overlayScriptPath = path.join(
      __dirname,
      "..",
      "electron",
      "overlay.js",
    );
    const args = [overlayScriptPath];

    if (id) {
      args.push(id);
    }

    // Fork the Electron process with overlay.js as an argument
    electronProcess = fork(electronCliPath, args, {
      env: {
        ...process.env,
        TD_OVERLAY_ID: id,
      },
      detached,
    });
  } catch (error) {
    logger.error("Failed to locate Electron CLI or start process:", error);
    throw error;
  }
  return new Promise((resolve, reject) => {
    electronProcess.on("error", reject);
    electronProcess.on("exit", (code) => {
      reject(new Error(`Electron process exited with code ${code}`));
    });
    electronProcess.on("spawn", () => {
      resolve(electronProcess);
    });
  });
};

module.exports.connectToOverlay = (id) => {
  return new Promise((resolve, reject) => {
    const overlayIpcId = `testdriverai_overlay_${id}`;
    setTimeout(() => {
      reject(new Error("Failed to connect to overlay"));
    }, 10000);

    let retries = 0;
    const maxRetries = 50;
    const { default: nodeIPC } = require("node-ipc");
    const client = new nodeIPC.IPC();
    client.config.id = `testdriverai_main_${process.pid}`;
    client.config.maxRetries = maxRetries;
    client.config.retryDelay = 100;
    client.config.silent = true;

    let connected = false;
    client.connectTo(overlayIpcId);
    client.of[overlayIpcId].on("connect", () => {
      connected = true;
      eventsArray.forEach((event) =>
        emitter.on(event, (data) => client.of[overlayIpcId].emit(event, data)),
      );
      resolve();
    });

    // Listen for terminal:stdin from overlay and emit to agent.js
    client.of[overlayIpcId].on("terminal:stdin", (data) => {
      emitter.emit("terminal:stdin", data);
    });

    client.of[overlayIpcId].on("error", (err) => {
      if (retries++ >= maxRetries) {
        logger.error("Overlay IPC error: %s", err);
        logger.error("Exiting...");
        process.exit(1);
      }
    });
    client.of[overlayIpcId].on("disconnect", () => {
      if (connected) {
        logger.error("Overlay IPC disconnected");
        logger.error("Exiting...");
        process.exit(1);
      }
    });
  });
};
