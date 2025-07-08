const { EventEmitter } = require("events");

const emitter = new EventEmitter();

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
    info: "log:info",
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

module.exports = { events, emitter, eventsArray };
