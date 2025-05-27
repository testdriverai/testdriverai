const say = require("say");
const config = require("./config");
const { logger } = require("./logger");

module.exports = (message) => {
  if (config["TD_SPEAK"]) {
    logger.debug(`${__filename}: %j`, message);
    say.stop();
    if (process.platform === "darwin") {
      say.speak(message, "Fred", 1.2);
    } else {
      say.speak(message);
    }
  }
};
