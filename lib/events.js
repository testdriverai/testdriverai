const { EventEmitter } = require("events");

const emitter = new EventEmitter();

const events = {
  showWindow: "show-window",
  mouseClick: {
    start: "mouse-click:start",
    end: "mouse-click:end",
  },
  mouseMove: "mouse-move",
  screenCapture: {
    start: "screen-capture:start",
    end: "screen-capture:end",
    error: "screen-capture:error",
  },
  interactive: "interactive",
  terminal: {
    stdout: "terminal:stdout",
    stderr: "terminal:stderr",
    stdin: "terminal:stdin", // Add stdin event
  },
  matches: {
    show: "matches:show",
  },
  vm: {
    show: "vm:show",
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
