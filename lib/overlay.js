const path = require("path");
const ipc = require("node-ipc").default;
const { fork } = require("child_process");

const { emitter, eventsArray } = require("./events.js");
const { logger } = require("./logger.js");

ipc.config.id = "testdriverai";
ipc.config.retry = 50;
ipc.config.silent = true;

let electronProcess;

logger.info("Spawning GUI...");

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


module.exports.electronProcessPromise = new Promise((resolve) => {
  ipc.connectTo("testdriverai_overlay");
  ipc.of.testdriverai_overlay.on("connect", () => {
    eventsArray.forEach((event) =>
      emitter.on(event, (data) =>
        ipc.of.testdriverai_overlay.emit(event, data),
      ),
    );
    resolve(electronProcess);
  });
});
