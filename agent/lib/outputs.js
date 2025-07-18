// Factory function to create outputs instance
function createOutputs() {
  let outputs = {};

  return {
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
}

// Export both factory function and legacy static instance for backward compatibility
const staticOutputs = createOutputs();

module.exports = {
  createOutputs,
  // Legacy static exports for backward compatibility
  getAll: staticOutputs.getAll,
  get: staticOutputs.get,
  set: staticOutputs.set,
};
