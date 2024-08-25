const sdk = require('./sdk');

module.exports = {track: async (event, data) => {

  if (process.env["TD_ANALYTICS"]) {
    return;
  } else {
    sdk.req('analytics', {event, data});
  }

}};
