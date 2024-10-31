const { EventEmitter } = require("events");

const emitter = new EventEmitter();

const events = {
  updateBoundingBoxes: "update-bounding-boxes",
  mouseClick: "mouse-click",
  screenCapture: {
    start: "screen-capture:start",
    end: "screen-capture:end",
    error: "screen-capture:error",
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
