const path = require("path");
const { default: nodeIPC } = require("node-ipc");
const client = new nodeIPC.IPC();
const { fork } = require("child_process");

const { emitter, eventsArray } = require("./events.js");
const { logger } = require("./logger.js");

client.config.id = `testdriverai_main_${process.pid}`;
client.config.retry = 50;
client.config.silent = true;

let electronProcess;

try {
  // Resolve the path to Electron CLI
  const electronCliPath = require.resolve('electron/cli.js');

  // Construct the path to the overlay.js script
  const overlayScriptPath = path.join(__dirname, '..', 'electron', 'overlay.js');

  // Fork the Electron process with overlay.js as an argument
  electronProcess = fork(
    electronCliPath,
    [overlayScriptPath],
    { stdio: 'ignore' }
  );

} catch (error) {
  logger.error("Failed to locate Electron CLI or start process:", error);
}

module.exports.electronProcessPromise = new Promise((resolve, reject) => {
  electronProcess.on("exit", (code) => {
    if (code === 0) {
      // Electron is not able to run in this environment
      resolve();
    } else {
      reject(new Error(`Electron process exited with code ${code}`));
    }
  });
  electronProcess.on("error", reject);
  const overlayIpcId = `testdriverai_overlay_${electronProcess.pid}`;
  client.connectTo(overlayIpcId);
  client.of[overlayIpcId].on("connect", () => {
    eventsArray.forEach((event) =>
      emitter.on(event, (data) => client.of[overlayIpcId].emit(event, data)),
    );
    resolve(electronProcess);
  });
});
