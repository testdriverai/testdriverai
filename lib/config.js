require('dotenv').config()

// Parse out true and false string values
function parseValue(value) {
    if (value === "false") {
        return false;
    }

    if (value === "true") {
        return true;
    }

    return value;
}

// Object for TD related config, with defaults
const config = {
    TD_SPEAK: false,
    TD_ANALYTICS: false,
    TD_NOTIFY: false,
};

// Find all env vars starting with TD_
for (let key in process.env) {
    if (key.startsWith("TD_")) {
        config[key] = parseValue(process.env[key]);
    }
}

module.exports = config;
