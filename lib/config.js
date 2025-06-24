/**
 * This file contains application config.
 * It is responsible for loading the config from env,
 * supplying defaults, and formatting values
 */

// Load the env vars from .env
require("dotenv").config();
const { logger } = require("./logger");

// Parse out true and false string values
function parseValue(value) {
  if (typeof value === "string") {
    const normalizedValue = value.toLowerCase().trim();
    if (["true", "false"].includes(normalizedValue)) {
      return JSON.parse(normalizedValue);
    }
  }

  return value;
}

const config = {
  TD_SPEAK: false,
  TD_ANALYTICS: true,
  TD_NOTIFY: false,
  TD_API_ROOT: "https://api.testdriver.ai",
  TD_API_KEY: null,
  TD_DEV: parseValue(process.env["DEV"]),
  TD_PROFILE: false,
  TD_OVERLAY: true,
  TD_OVERLAY_ID: null,
  TD_RESOLUTION: [1366, 768],
  TD_IPC_ID: `testdriverai_${process.pid}`,
};

// Find all env vars starting with TD_
for (let key in process.env) {
  if (key == "TD_RESOLUTION") {
    config[key] = process.env[key].split("x").map((x) => parseInt(x.trim()));
    continue;
  }

  if (key.startsWith("TD_")) {
    config[key] = parseValue(process.env[key]);
  }
}

if (config.TD_DEV) {
  logger.info("Testdriverai config: %j", config);
}

module.exports = config;
