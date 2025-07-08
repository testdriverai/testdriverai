let outputs = {};
const { logger } = require("../../interfaces/logger");

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
      logger.info(`OUTPUT.${key} = ${value}`);
    }
  },
};
