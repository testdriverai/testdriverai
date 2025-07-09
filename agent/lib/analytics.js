const { createSDK } = require("./sdk");
const config = require("./config");

// Factory function that creates analytics with the provided emitter
const createAnalytics = (emitter) => {
  const sdk = createSDK(emitter);

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
