const { logger } = require("./logger");
const sandbox = require("./sandbox");

async function focusApplication(appName) {
  let result = await sandbox.send({
    type: "commands.run",
    command: `/home/user/scripts/control_window.sh "${appName}" Focus`,
  });
  if (result.type == "error") {
    logger.debug(result.error.result.stdout);
  }
}

module.exports = {
  focusApplication,
};
