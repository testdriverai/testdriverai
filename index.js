#!/usr/bin/env node
const config = require("./lib/config.js");
// We need to initialize the IPC server quickly
require("./lib/ipc.js");
const { emitter, events } = require("./lib/events.js");
const { logger } = require("./lib/logger.js");

if (process.argv[2] === "--help" || process.argv[2] === "-h") {
  console.log("Command: testdriverai [init, run, edit] [yaml filepath]");
  process.exit(0);
}

if (process.argv[2] === "--renderer") {

  const {
    // connectToOverlay,
    createOverlayProcess,
  } = require("./lib/overlay.js");
  // const id = config.TD_OVERLAY_ID;
  const id = process.argv[3] ?? config.TD_OVERLAY_ID;
  if (!id) {
    logger.error("Renderer ID is not set");
    process.exit(1);
  }
  (async () => {
    try {
      if (!id) {
        throw new Error("Renderer ID is not set");
      }
      const electronProcess = await createOverlayProcess({
        id,
        detached: true,
      });
      logger.info(`Started renderer, process ID: ${electronProcess.pid}`);
      process.exit(0);
    } catch (err) {
      logger.error("%s", err);
      process.exit(1);
    }
  })();
} else {
  (async () => {

    if (!config.TD_OVERLAY) {
      let agent = require("./agent.js");
      await agent.start();
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

      const {
        connectToOverlay,
        createOverlayProcess,
      } = require("./lib/overlay.js");

      try {
        let id = config.TD_OVERLAY_ID;
        if (!id) {
          const electronProcess = await createOverlayProcess();
          electronProcess.on("exit", (code) => {
            logger.info(`Renderer process exited with code ${code}`);
            process.exit(code);
          });
          id = electronProcess.pid;
        }

        await connectToOverlay(id);
        await require("./agent.js").start();
      } catch (err) {
        logger.error("%s", err);
        process.exit(1);
      }
    }
  })();
}
