/**
 * This file contains application config factory.
 * It is responsible for creating config instances from environment variables,
 * supplying defaults, and formatting values
 */

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

// Factory function that creates a config instance
const createConfig = (environment = {}) => {
  // Start with defaults
  const config = {
    TD_ANALYTICS: true,
    TD_API_ROOT: "https://v6.testdriver.ai",
    TD_API_KEY: null,
    TD_PROFILE: false,
    TD_RESOLUTION: [1366, 768],
  };

  // Store the full environment for interpolation purposes
  config._environment = environment;

  // Find all env vars starting with TD_
  for (let key in environment) {
    if (key == "TD_RESOLUTION") {
      config[key] = environment[key].split("x").map((x) => parseInt(x.trim()));
      continue;
    }

    if (key.startsWith("TD_")) {
      config[key] = parseValue(environment[key]);
    }
  }

  // Add support for CI environment variable
  if (environment.CI) {
    config.CI = parseValue(environment.CI);
  }

  return config;
};

// Create a default config instance for backward compatibility
const defaultConfig = createConfig(process.env);

// Export both the factory function and the default instance
module.exports = defaultConfig;
module.exports.createConfig = createConfig;
