let outputs = {};

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
    }
  },
};
