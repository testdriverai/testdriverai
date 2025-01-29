#!/usr/bin/env node
import config from "./lib/config.js";
import system from "./lib/system.js";
import { emitter, events } from "./lib/events.js";

(async () => {

  let win = await system.activeWin();

  if (!config.TD_OVERLAY) {
    let agent = await import("./agent.js");
    agent.setTerminalApp(win);
    agent.start();
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
  
    const overlay = await import("./lib/overlay.js");
    overlay.electronProcessPromise
      .then(() => {
        let agent = import("./agent.js");
        agent.setTerminalApp(win);
        agent.start();
      })
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  }

  
})()
