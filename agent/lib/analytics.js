const sdk = require("./sdk");
const config = require("./config");

module.exports = {
  track: async (event, data) => {
    if (!config["TD_ANALYTICS"]) {
      return;
    } else {
      await sdk.req("analytics", { event, data });
    }
  },
};
