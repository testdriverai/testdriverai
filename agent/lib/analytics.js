const { createSDK } = require("./sdk");

// Factory function that creates analytics with the provided emitter, config, and session
const createAnalytics = (emitter, config, sessionInstance) => {
  const sdk = createSDK(emitter, config, sessionInstance);

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
