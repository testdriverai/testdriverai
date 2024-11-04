const { EventEmitter } = require("events");

const emitter = new EventEmitter();

const events = {
  mouseClick: "mouse-click",
  screenCapture: {
    start: "screen-capture:start",
    end: "screen-capture:end",
    error: "screen-capture:error",
  },
  interactive: "interactive",
  terminal: {
    stdout: "terminal:stdout",
    stderr: "terminal:stderr",
  },
  overlay: {
    ping: "overlay:ping",
  },
  matches: {
    show: "matches:show",
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
