const say = require("say");
const config = require("./config");
const websockets = require("./websockets");


module.exports = (message) => {
  if (config["TD_SPEAK"]) {
    say.stop();
    if (process.platform === "darwin") {
      say.speak(message, "Fred", 1.2);
    } else {
      say.speak(message);
    }
  }
};
