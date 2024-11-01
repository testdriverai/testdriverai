#!/usr/bin/env node
const config = require("./lib/config");
const { emitter, events } = require("./lib/events.js");

if (config.TD_DISABLE_OVERLAYS) {
  require("./index.js");
} else {
  require("./lib/overlay.js")
    .electronProcessPromise.then(() => {
      require("./index.js");
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
