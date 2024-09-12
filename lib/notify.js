const notifier = require("node-notifier");
const path = require("path");
const config = require("./config");

module.exports = (message) => {

  if (config["TD_NOTIFY"]) {
    
    return notifier.notify({
      title: "TestDriver.ai",
      message,
      timeout: 5,
      icon: path.join(__dirname, "images", "icon.png"),
      sound: false
    });
    
  }

};
