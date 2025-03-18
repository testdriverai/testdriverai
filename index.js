#!/usr/bin/env node
const config = require("./lib/config.js");
const system = require("./lib/system.js");
const { emitter, events } = require("./lib/events.js");
const { logger } = require("./lib/logger.js");
const sandbox = require("./lib/sandbox.js");

(async () => {

  let win = await system.activeWin();

  if (!config.TD_OVERLAY) {
    let agent = require("./agent.js");
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
  
    require("./lib/overlay.js")
      .electronProcessPromise.then(async () => {

          let agent = require("./agent.js");
      
          if (config.TD_VM) {
            await sandbox.boot();
            await sandbox.send({type: 'create', resolution: [1024, 768]});
            await sandbox.send({type: 'stream.start'});
            let {url} = await sandbox.send({type: 'stream.getUrl'});
            emitter.emit(events.vm.show, {url}); 
          } else {
            agent.setTerminalApp(win);
          }

          agent.start();
        
      })
      .catch((err) => {
        logger.error("%s", err);
        process.exit(1);
      });
  }

  
})()
