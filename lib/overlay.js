const path = require("path");
const ipc = require("node-ipc").default;
const { spawn } = require("child_process");

const { emitter, eventsArray } = require("./events.js");

ipc.config.id = "testdriverai";
ipc.config.retry = 50;
ipc.config.silent = true;

const electronProcess = spawn(
  path.join(__dirname, "../node_modules/.bin/electron"),
  [path.join(__dirname, "../electron/overlay.js")],
);

electronProcess.on("exit", (code) => {
  process.exit(code);
});

ipc.connectTo("testdriverai_overlay");

ipc.of.testdriverai_overlay.on("connect", () => {
  eventsArray.forEach((event) =>
    emitter.on(event, (data) => ipc.of.testdriverai_overlay.emit(event, data)),
  );
});

module.exports.electronProcess = electronProcess;
