const { Command } = require("@oclif/core");
const { emitter, events } = require("../../../agent/events.js");
const { createCommandDefinitions } = require("../../../agent/interface.js");

class BaseCommand extends Command {
  constructor(argv, config) {
    super(argv, config);
    this.agent = null; // Initialize as null, create only when needed
  }

  setupEventListeners() {
    const { eventsArray } = require("../../../agent/events.js");

    // Set up listeners for all events
    for (const eventName of eventsArray) {
      emitter.on(eventName, (...args) => {
        const timestamp = new Date().toISOString();
        const formattedArgs = args
          .map((arg) =>
            typeof arg === "object"
              ? JSON.stringify(arg, null, 2)
              : String(arg),
          )
          .join(" ");

        // Use different prefixes for different event types
        let prefix = "[EVENT]";
        if (eventName.includes("error")) {
          prefix = "[ERROR]";
        } else if (eventName.includes("warn")) {
          prefix = "[WARN]";
        } else if (eventName.includes("info")) {
          prefix = "[INFO]";
        } else if (eventName.includes("debug")) {
          prefix = "[DEBUG]";
        } else if (eventName.includes("sandbox")) {
          prefix = "[SANDBOX]";
        } else if (eventName.includes("log")) {
          prefix = "[LOG]";
        }

        console.log(`${prefix} [${timestamp}] ${eventName}: ${formattedArgs}`);
      });
    }

    console.log(`Set up listeners for ${eventsArray.length} events`);
  }

  setupProcessHandlers() {
    // Process error handlers
    process.on("uncaughtException", async (err) => {
      emitter.emit(events.log.error, "Uncaught Exception: %s", err);
      if (this.agent) {
        await this.agent.exit(true);
      } else {
        process.exit(1);
      }
    });

    process.on("unhandledRejection", async (reason, promise) => {
      emitter.emit(
        events.log.error,
        "Unhandled Rejection at: %s, reason: %s",
        promise,
        reason,
      );
      if (this.agent) {
        await this.agent.exit(true);
      } else {
        process.exit(1);
      }
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
    const path = require("path");

    // Create the agent only when actually needed
    if (!this.agent) {
      const TestDriverAgent = require("../../../agent/index.js");
      this.agent = new TestDriverAgent();
      this.setupEventListeners();
      this.setupProcessHandlers();
    }

    // Set up agent properties from CLI args
    this.agent.cliArgs = {
      command: this.id,
      args: [file],
      options: flags,
    };
    this.agent.thisFile = this.normalizeFilePath(file);

    // Set output file for summarize results if specified
    if (flags.summary && typeof flags.summary === "string") {
      this.agent.resultFile = path.resolve(flags.summary);
    }

    // Start the agent's initialization
    await this.agent.start();
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
