const { createSDK } = require("./sdk");

// Factory function that creates analytics with the provided emitter, config, and session
const createAnalytics = (emitter, config, sessionInstance) => {
  const sdk = createSDK(emitter, config, sessionInstance);

  return {
    track: async (event, data) => {
      if (!config["TD_ANALYTICS"]) {
        return;
      }
      if (Math.random() <= 0.01) {
        // Fire-and-forget: don't await analytics calls
        sdk.req("analytics", { event, data }).catch((err) => {
          console.warn("Analytics track failed:", err.message);
        });
      }
    },
  };
};

module.exports = { createAnalytics };
