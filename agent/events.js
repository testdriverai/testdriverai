const { EventEmitter } = require("events");

// Global reference to the current agent's emitter
let currentEmitter = null;

// Factory function to create a new emitter instance
const createEmitter = () => {
  const emitter = new EventEmitter();
  return emitter;
};

// Function to set the current emitter for all modules to use
const setEmitter = (emitter) => {
  currentEmitter = emitter;
};

// Function to get the current emitter
const getEmitter = () => {
  if (!currentEmitter) {
    throw new Error("Emitter not initialized. Call setEmitter() first.");
  }
  return currentEmitter;
};

const events = {
  showWindow: "show-window",
  mouseClick: "mouse-click",
  mouseMove: "mouse-move",
  screenCapture: {
    start: "screen-capture:start",
    end: "screen-capture:end",
    error: "screen-capture:error",
  },
  terminal: {
    stdout: "terminal:stdout",
    stderr: "terminal:stderr",
  },
  matches: {
    show: "matches:show",
  },
  vm: {
    show: "vm:show",
  },
  status: "status",
  log: {
    markdown: {
      static: "log:markdown:static",
      start: "log:markdown:start",
      chunk: "log:markdown:chunk",
      end: "log:markdown:end",
    },
    log: "log:log",
    warn: "log:warn",
    error: "log:error",
    debug: "log:debug",
  },
  sandbox: {
    connected: "sandbox:connected",
    errored: "sandbox:error",
    disconnect: "sandbox:disconnected",
    sensitiveHeaders: "sandbox:sent",
    received: "sandbox:received",
  },
  outputs: {
    set: "outputs:set",
  },
  history: {
    add: "history:add",
    clear: "history:clear",
    set: "history:set",
  },
  redraw: {
    status: "redraw:status",
    complete: "redraw:complete",
  },
  sdk: {
    error: "sdk:error",
    parseError: "sdk:parseError",
  },
  subimage: {
    error: "subimage:error",
  },
};

const getValues = (obj) => {
  if (["string", "number"].includes(typeof obj)) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(getValues);
  }
  if ([undefined, null].includes(obj)) {
    return [];
  }

  return Object.values(obj).map(getValues).flat();
};

const eventsArray = getValues(events);

module.exports = { events, createEmitter, setEmitter, getEmitter, eventsArray };
