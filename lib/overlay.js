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

process.on("exit", () => electronProcess.kill("SIGTERM"));
process.on("SIGINT", () => electronProcess.kill("SIGTERM")); // Ctrl+C
process.on("SIGTERM", () => electronProcess.kill("SIGTERM")); // Termination signal
process.on("uncaughtException", () => electronProcess.kill("SIGTERM"));

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
