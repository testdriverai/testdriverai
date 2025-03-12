let outputs = {};

module.exports = {
  get: (key) => {
    return outputs[key] || null;
  },
  set: (key, value) => {
    if (key && value) {
      outputs[key] = value;
    }
  },
};
