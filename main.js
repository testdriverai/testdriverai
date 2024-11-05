#!/usr/bin/env node
const config = require("./lib/config");
const { emitter, events } = require("./lib/events.js");

if (config.TD_DISABLE_OVERLAYS) {
  require("./index.js");
} else {
  // Intercept all stdout and stderr calls (works with console as well)
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (...args) => {
    const [data, encoding] = args;
    emitter.emit(
      events.terminal.stdout,
      data.toString(typeof encoding === "string" ? encoding : undefined),
    );
    originalStdoutWrite(...args);
  };

  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (...args) => {
    const [data, encoding] = args;
    emitter.emit(
      events.terminal.stderr,
      data.toString(typeof encoding === "string" ? encoding : undefined),
    );
    originalStderrWrite(...args);
  };

  require("./lib/overlay.js")
    .electronProcessPromise.then(() => {
      setInterval(() => {
        emitter.emit(events.overlay.ping);
      }, 200);
      require("./index.js");
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
