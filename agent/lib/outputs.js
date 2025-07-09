let outputs = {};
const { events, emitter } = require("../events");

module.exports = {
  getAll: () => {
    return outputs;
  },
  get: (key) => {
    return outputs[key] || null;
  },
  set: (key, value) => {
    if (key && value) {
      outputs[key] = value;
      emitter.emit(events.outputs.set, { key, value });
    }
  },
};
