const { Command } = require("@oclif/core");
const { events, eventsArray } = require("../../../agent/events.js");
const { createCommandDefinitions } = require("../../../agent/interface.js");
const path = require("path");
const fs = require("fs");
const os = require("os");
const logger = require("../../logger.js");

async function openBrowser(url) {
  try {
    // Use dynamic import for the 'open' package (ES module)
    const { default: open } = await import("open");

    // Open the browser
    await open(url, {
      // Wait for the app to open
      wait: false,
    });
  } catch (error) {
    console.error("Failed to open browser automatically:", error);
    console.log(`Please manually open: ${url}`);
  }
}

class BaseCommand extends Command {
  constructor(argv, config) {
    super(argv, config);
    this.agent = null; // Initialize as null, create only when needed
  }

  sendToSandbox(message) {
    this.agent.sandbox.send({
      type: "output",
      output: Buffer.from(message).toString("base64"),
    });
  }

  setupEventListeners() {
    const { events } = require("../../../agent/events.js");

    if (!this.logFilePath) {
      // Create a temp log file for this session
      this.logFilePath = path.join(
        os.tmpdir(),
        `testdriverai-cli-${process.pid}.log`,
      );

      console.log(`Log file created at: ${this.logFilePath}`);
      fs.writeFileSync(this.logFilePath, ""); // Initialize the log file
    }

    // Helper to append log messages to the temp file
    const appendLog = (level, message) => {
      const timestamp = new Date().toISOString();
      fs.appendFileSync(
        this.logFilePath,
        `[${timestamp}] [${level}] ${message}\n`,
      );
    };
    this.agent.emitter.on(events.status, (message) => {
      console.log(`- ${message}`);
      this.sendToSandbox(`- ${message}`);
    });

    // Console logging
    this.agent.emitter.on(events.log.log, (message) => {
      console.log(message);
    });

    this.agent.emitter.on(events.log.warn, (message) => {
      console.log(message);
    });

    this.agent.emitter.on(events.error.general, (message) => {
      console.log(message);
    });

    this.agent.emitter.on("sandbox:connected", () => {
      this.agent.emitter.on(events.log.log, (message) => {
        this.sendToSandbox(message);
      });
      this.agent.emitter.on(events.log.warn, (message) => {
        this.sendToSandbox(message);
      });
      this.agent.emitter.on(events.error.general, (message) => {
        this.sendToSandbox(message);
      });
      this.agent.emitter.on(events.log.markdown.static, (message) => {
        // logger.createMarkdownLogger will handle this
        this.sendToSandbox(message);
      });
      this.agent.emitter.on(events.log.markdown.chunk, (message) => {
        // logger.createMarkdownLogger will handle this
        this.sendToSandbox(message);
      });
    });

    // loop through all events and set up listeners
    for (const eventName of Object.values(eventsArray)) {
      if (eventName.split(":")[0] === "error") {
        this.agent.emitter.on(eventName, (data) => {
          console.error(eventName, ":", data);
          if (eventName == events.error.sandbox) {
            console.error("Use --new-sandbox to create a new sandbox.");
          }
        });
      }
    }

    // loop through all events and set up listeners
    for (const eventName of Object.values(eventsArray)) {
      this.agent.emitter.on(eventName, (data) => {
        appendLog(eventName, JSON.stringify(data));
      });
    }

    logger.createMarkdownLogger(this.agent.emitter);
    // Handle exit events by exiting the process with the appropriate code
    this.agent.emitter.on(events.exit, (exitCode) => {
      process.exit(exitCode);
    });

    this.agent.emitter.on(events.showWindow, async (data) => {
      const encodedData = encodeURIComponent(JSON.stringify(data));
      // Use the debugger URL instead of the VNC URL
      const urlToOpen = this.agent.debuggerUrl
        ? `${this.agent.debuggerUrl}?data=${encodedData}`
        : `${data.url}?data=${encodedData}`;
      await openBrowser(urlToOpen);
    });
  }

  async init() {
    // Only start debugger for commands that actually need it
    // Help commands and other static commands don't need the debugger
  }

  // Extract file path from args or use default
  normalizeFilePath(file) {
    const path = require("path");
    if (!file) {
      file = "testdriver/testdriver.yaml";
    }
    file = path.join(this.agent.workingDir, file);
    if (!file.endsWith(".yaml") && !file.endsWith(".yml")) {
      file += ".yaml";
    }
    return file;
  }

  async setupAgent(file, flags) {
    // Create the agent only when actually needed
    const TestDriverAgent = require("../../../agent/index.js");

    this.agent = new TestDriverAgent();
    this.setupEventListeners();

    // Set up agent properties from CLI args
    this.agent.cliArgs = {
      command: this.id,
      args: [file],
      options: flags,
    };
    // Use --path flag if provided, otherwise use the file argument
    const filePath = this.id === "run" && flags.path ? flags.path : file;
    this.agent.thisFile = this.normalizeFilePath(filePath);

    // Set output file for summarize results if specified
    if (flags.summary && typeof flags.summary === "string") {
      this.agent.resultFile = path.resolve(flags.summary);
    }

    try {
      // Start the agent's initialization
      await this.agent.start();
    } catch (e) {
      console.error("Failed to start agent:", e);
      this.agent.emitter.emit(
        events.error.general,
        "Failed to start agent: %s",
        e,
      );
      if (this.agent) {
        await this.agent.exit(true);
      } else {
        process.exit(1);
      }
    }
  }

  // Get unified command definition for this command
  getUnifiedDefinition() {
    const commandName = this.id;
    if (!this.agent) {
      // Create a temporary agent for definition purposes
      const tempAgent = { workingDir: process.cwd() };
      return createCommandDefinitions(tempAgent)[commandName];
    }
    const definitions = createCommandDefinitions(this.agent);
    return definitions[commandName];
  }
}

module.exports = BaseCommand;
