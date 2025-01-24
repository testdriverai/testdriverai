/**
 * This file contains application config.
 * It is responsible for loading the config from env,
 * supplying defaults, and formatting values
 */

// Load the env vars from .env
require("dotenv").config();

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

// Object for TD related config, with defaults
const config = {
  TD_SPEAK: false,
  TD_ANALYTICS: true,
  TD_NOTIFY: false,
  TD_MINIMIZE: true,
  TD_API_ROOT: "https://api.testdriver.ai",
  TD_DEV: parseValue(process.env["DEV"]),
  TD_PROFILE: false,
  TD_OVERLAY: true
};

// Find all env vars starting with TD_
for (let key in process.env) {
  if (key.startsWith("TD_")) {
    config[key] = parseValue(process.env[key]);
  }
}

if (config.TD_DEV) {
  console.info("Testdriverai config: ", config);
}

module.exports = config;
