// Shared censorship functionality for sensitive data
// Uses @npmcli/redact for common patterns (URLs, auth headers, etc.)
// Plus custom logic for environment variables and interpolation vars
const { redactLog } = require("@npmcli/redact");

let interpolationVars = JSON.parse(process.env.TD_INTERPOLATION_VARS || "{}");

// Handle local `TD_*` variables
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith("TD_") && key !== "TD_INTERPOLATION_VARS") {
    interpolationVars[key] = value;
  }
}

// Function to censor sensitive data in strings using both npmcli/redact and custom logic
const censorSensitiveData = (message) => {
  if (typeof message !== "string") {
    return message;
  }

  // First, use npmcli/redact for common patterns:
  // - URLs with credentials (https://user:pass@host)
  // - Authorization headers
  // - Common secret patterns in logs
  let result = redactLog(message);

  // Then apply our custom interpolation variable redaction
  // This catches application-specific secrets from TD_* env vars
  for (let value of Object.values(interpolationVars)) {
    // Avoid replacing vars that are 0 or 1 characters
    if (value && value.length >= 2) {
      result = result.replaceAll(value, "****");
    }
  }

  return result;
};

// Function to censor sensitive data in any value (recursive for objects/arrays)
const censorSensitiveDataDeep = (value) => {
  try {
    if (typeof value === "string") {
      return censorSensitiveData(value);
    } else if (Array.isArray(value)) {
      return value.map(censorSensitiveDataDeep);
    } else if (value && typeof value === "object") {
      const result = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = censorSensitiveDataDeep(val);
      }
      return result;
    }
    return value;
  } catch {
    // If we hit any error (like circular reference), just return a safe placeholder
    return "[Object]";
  }
};

// Function to update interpolation variables (for runtime updates)
const updateInterpolationVars = (newVars) => {
  interpolationVars = { ...interpolationVars, ...newVars };
};

// Function to get current interpolation variables (for debugging)
const getInterpolationVars = () => {
  return { ...interpolationVars };
};

module.exports = {
  censorSensitiveData,
  censorSensitiveDataDeep,
  updateInterpolationVars,
  getInterpolationVars,
};
