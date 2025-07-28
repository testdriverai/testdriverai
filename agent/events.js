const { EventEmitter2 } = require("eventemitter2");
const { censorSensitiveDataDeep } = require("./lib/censorship");

// Factory function to create a new emitter instance with censoring middleware
const createEmitter = () => {
  const emitter = new EventEmitter2({
    wildcard: true,
    delimiter: ":",
    newListener: false,
    removeListener: false,
    maxListeners: 20,
    verboseMemoryLeak: false,
    ignoreErrors: false,
  });

  // Override emit to censor sensitive data before emitting
  const originalEmit = emitter.emit.bind(emitter);
  emitter.emit = function (event, ...args) {
    // Censor all arguments passed to emit
    const censoredArgs = args.map(censorSensitiveDataDeep);
    return originalEmit(event, ...censoredArgs);
  };

  return emitter;
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
  narration: "narration",
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
    debug: "log:debug",
  },
  command: {
    start: "command:start",
    stop: "command:stop",
    success: "command:success",
    error: "command:error",
    status: "command:status",
    progress: "command:progress",
    location: "command:location",
  },
  step: {
    start: "step:start",
    stop: "step:stop",
    success: "step:success",
    error: "step:error",
    status: "step:status",
    progress: "step:progress",
  },
  file: {
    start: "file:start",
    stop: "file:stop",
    load: "file:load",
    save: "file:save",
    modification: "file:modification",
    error: "file:error",
    status: "file:status",
  },
  error: {
    fatal: "error:fatal",
    general: "error:general",
    sdk: "error:sdk",
    sandbox: "error:sandbox",
  },
  sdk: {
    error: "sdk:error",
    request: "sdk:request",
    response: "sdk:response",
    progress: "sdk:progress",
  },
  sandbox: {
    connected: "sandbox:connected",
    authenticated: "sandbox:authenticated",
    errored: "sandbox:error",
    disconnect: "sandbox:disconnected",
    sent: "sandbox:sent",
    received: "sandbox:received",
  },
  redraw: {
    status: "redraw:status",
    complete: "redraw:complete",
  },
  exit: "exit",
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

module.exports = { events, createEmitter, eventsArray };
