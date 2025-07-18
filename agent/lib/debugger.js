const { eventsArray, getEmitter } = require("../events.js");
const { startDebugger, broadcastEvent } = require("./debugger-server.js");

module.exports.createDebuggerProcess = (config = {}) => {
  // Start the web server-based debugger instead of Electron
  return startDebugger(config)
    .then(({ url }) => {
      // Return a mock process object to maintain compatibility
      return {
        pid: process.pid,
        url: url, // Include the debugger URL
        kill: () => {
          const { stopDebugger } = require("./debugger-server.js");
          stopDebugger();
        },
        on: (event, callback) => {
          // Mock process events
          if (event === "exit") {
            process.on("exit", callback);
          }
        },
      };
    })
    .catch((error) => {
      throw error;
    });
};

module.exports.connectToDebugger = () => {
  return new Promise((resolve, reject) => {
    // Set up event broadcasting instead of IPC
    try {
      const emitter = getEmitter();
      eventsArray.forEach((event) => {
        emitter.on(event, (data) => {
          broadcastEvent(event, data);
        });
      });

      // Resolve immediately since we don't need to wait for IPC connection
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};
