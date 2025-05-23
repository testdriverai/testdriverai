#!/usr/bin/env node

// being called on server with 
// {
//  TD_SPEAK: false,
//  TD_ANALYTICS: true,
//  TD_NOTIFY: false,
//  TD_MINIMIZE: false,
//  TD_API_ROOT: 'https://api.testdriver.ai',
//  TD_API_KEY: 'xxx',
//  TD_DEV: undefined,
//  TD_PROFILE: false,
//  TD_OVERLAY: true,
//  TD_SECRET: 'xxx',
//  TD_VM: true,
//  TD_OVERLAY_ID: null,
//  TD_VM_RESOLUTION: [ 1920, 1080 ],
//  TD_IPC_ID: 'testdriverai_4708',
//  TD_INTERPOLATION_VARS: '{"TD_WEBSITE":"https://testdriver-sandbox.vercel.app","TD_VM_RESOLUTION":"1920x1080"}',
//  TD_WEBSITE: 'https://testdriver-sandbox.vercel.app'
// }

const config = require("./lib/config.js");

// We need to initialize the IPC server quickly
require("./lib/ipc.js");
const { emitter, events } = require("./lib/events.js");
const { logger } = require("./lib/logger.js");

logger.info('Config is')
console.log(config)

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
      setTimeout(() => process.exit(0), 200);
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
