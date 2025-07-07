const { logger } = require("./logger.js");
const { emitter, eventsArray } = require("./events.js");
const { startDebugger, broadcastEvent } = require("./debugger-server.js");

module.exports.createDebuggerProcess = () => {
  // Start the web server-based debugger instead of Electron
  logger.info("[DEBUG] Calling startDebugger() in createDebuggerProcess");
  return startDebugger()
    .then(({ url }) => {
      logger.info(`[DEBUG] Debugger server started at: ${url}`);
      // Return a mock process object to maintain compatibility
      return {
        pid: process.pid,
        kill: () => {
          logger.info("[DEBUG] Killing debugger process");
          const { stopDebugger } = require("./debugger-server.js");
          stopDebugger();
        },
        on: (event, callback) => {
          // Mock process events
          logger.info(`[DEBUG] Registering process event: ${event}`);
          if (event === "exit") {
            process.on("exit", callback);
          }
        },
      };
    })
    .catch((error) => {
      logger.error("[DEBUG] Failed to start debugger server:", error);
      throw error;
    });
};

module.exports.connectToDebugger = () => {
  return new Promise((resolve, reject) => {
    // Set up event broadcasting instead of IPC
    try {
      logger.info("[DEBUG] Setting up event broadcasting in connectToDebugger");
      eventsArray.forEach((event) => {
        emitter.on(event, (data) => {
          logger.info(`[DEBUG] Broadcasting event: ${event}`);
          broadcastEvent(event, data);
        });
      });

      // Resolve immediately since we don't need to wait for IPC connection
      logger.info("[DEBUG] connectToDebugger resolved");
      resolve();
    } catch (error) {
      logger.error("[DEBUG] connectToDebugger error:", error);
      reject(error);
    }
  });
};
