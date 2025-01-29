import sdk from './sdk.js';
import config from './config.js';

export default {
  track: async (event, data) => {
    if (!config["TD_ANALYTICS"]) {
      return;
    } else {
      await sdk.req("analytics", { event, data });
    }
  },
};
