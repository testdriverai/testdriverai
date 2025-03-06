function enableExecFilePatch() {
    const childProcess = require('child_process');

    if (childProcess.execFile.__patched) {
        return; // Prevent multiple patches
    }

    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const originalExecFile = childProcess.execFile;

    function isInsideSnapshot(filePath) {
        return filePath.startsWith('/snapshot/') || filePath.includes('C:\\snapshot\\');
    }

    function getTempFilePath(originalPath) {
        return path.join(os.tmpdir(), path.basename(originalPath));
    }

    childProcess.execFile = function (file, ...args) {
        if (isInsideSnapshot(file)) {
            const tempFilePath = getTempFilePath(file);
            fs.copyFileSync(file, tempFilePath);
            fs.chmodSync(tempFilePath, 0o755);
            file = tempFilePath;
        }

        return originalExecFile(file, ...args);
    };

    Object.defineProperty(childProcess.execFile, "__patched", {
        value: true,
        configurable: false,
        enumerable: false,
        writable: false
    });
}

enableExecFilePatch();

const config = require("./lib/config.js");
const system = require("./lib/system.js");
const { emitter, events } = require("./lib/events.js");
const { logger } = require("./lib/logger.js");

(async () => {

  let win = await system.activeWin();

  if (!config.TD_OVERLAY) {
    let agent = require("./agent.js");
    agent.setTerminalApp(win);
    agent.start();
  } else {
    // Intercept all stdout and stderr calls (works with console as well)
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (...args) => {
      const [data, encoding] = args;
      emitter.emit(
        events.terminal.stdout,
        data.toString(typeof encoding === "string" ? encoding : undefined),
      );
      originalStdoutWrite(...args);
    };
  
    const originalStderrWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = (...args) => {
      const [data, encoding] = args;
      emitter.emit(
        events.terminal.stderr,
        data.toString(typeof encoding === "string" ? encoding : undefined),
      );
      originalStderrWrite(...args);
    };
  
    require("./lib/overlay.js")
      .electronProcessPromise.then(() => {
        let agent = require("./agent.js");
        agent.setTerminalApp(win);
        agent.start();
      })
      .catch((err) => {
        logger.error("%s", err);
        process.exit(1);
      });
  }

  
})()
