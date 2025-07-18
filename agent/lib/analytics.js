const { createSDK } = require("./sdk");

// Factory function that creates analytics with the provided emitter and config
const createAnalytics = (emitter, config) => {
  const sdk = createSDK(emitter, config);

  return {
    track: async (event, data) => {
      if (!config["TD_ANALYTICS"]) {
        return;
      } else {
        await sdk.req("analytics", { event, data });
      }
    },
  };
};

module.exports = { createAnalytics };
