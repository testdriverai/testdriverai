/*
This is an implementation of the TestDriver library. This file should not:
- modify the agent's state
- emit events back to the agent
- etc
*/

const { Command } = require("@oclif/core");
const { events } = require("../../../agent/events.js");
const { createCommandDefinitions } = require("../../../agent/interface.js");
const { createJUnitReporter } = require("../../junit-reporter.js");
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
    // ensure message is a string
    if (typeof message !== "string") {
      message = JSON.stringify(message);
    }
    this.agent.sandbox.send({
      type: "output",
      output: Buffer.from(message).toString("base64"),
    });
  }

  setupEventListeners() {
    if (!this.logFilePath) {
      // Create a temp log file for this session
      this.logFilePath = path.join(
        os.tmpdir(),
        `testdriverai-cli-${process.pid}.log`,
      );

      console.log(`Log file: ${this.logFilePath}`);
      console.log("");
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

    let isConnected = false;

    // Use pattern matching for log events, but skip log:Debug
    this.agent.emitter.on("log:*", (message) => {
      const event = this.agent.emitter.event;

      if (event === events.log.debug) return;

      if (event === events.log.narration && isConnected) return;
      console.log(message);
    });

    // Use pattern matching for error events
    this.agent.emitter.on("error:*", (data) => {
      const event = this.agent.emitter.event;
      console.error(event, ":", data);
    });

    // Handle status events
    this.agent.emitter.on("status", (message) => {
      console.log(`- ${message}`);
      this.sendToSandbox(`- ${message}`);
    });

    // Handle sandbox connection with pattern matching for subsequent events
    this.agent.emitter.on("sandbox:connected", () => {
      isConnected = true;
      // Once sandbox is connected, send all log and error events to sandbox
      this.agent.emitter.on("log:*", (message) => {
        this.sendToSandbox(message);
      });

      this.agent.emitter.on("error:*", (message) => {
        this.sendToSandbox(message);
      });
    });

    // Handle all other events with wildcard pattern
    this.agent.emitter.on("**", (data) => {
      const event = this.agent.emitter.event;
      appendLog(event, JSON.stringify(data));
    });

    logger.createMarkdownLogger(this.agent.emitter);

    // Initialize JUnit reporter if junit flag is provided
    if (this.agent.cliArgs?.options?.junit) {
      const junitOutputPath = this.agent.cliArgs.options.junit;
      const mainTestFile = this.agent.thisFile; // Get the main test file from the agent
      this.junitReporter = createJUnitReporter(
        this.agent.emitter,
        junitOutputPath,
        mainTestFile,
      );
      console.log(`JUnit reporting enabled: ${junitOutputPath}`);
    }

    this.agent.emitter.on("exit", (exitCode) => {
      process.exit(exitCode);
    });

    // Handle unhandled promise rejections to prevent them from interfering with the exit flow
    // This is particularly important when JavaScript execution in VM contexts leaves dangling promises
    process.on("unhandledRejection", (reason) => {
      // Log the rejection but don't let it crash the process
      console.error("Unhandled Promise Rejection:", reason);
      // The exit flow should continue normally
    });

    // Handle show window events
    this.agent.emitter.on("show-window", async (url) => {
      console.log("");
      console.log(`Live test execution: `);
      if (this.agent.config.CI) {
        let u = new URL(url);
        u = JSON.parse(u.searchParams.get("data"));
        console.log(`${u.url}&view_only=true`);
      } else {
        console.log(url);
        await openBrowser(url);
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
      // Use config default if agent is available, otherwise fall back to hardcoded default
      file = "testdriver/testdriver.yaml";
    }
    file = path.join(this.agent.workingDir, file);
    if (!file.endsWith(".yaml") && !file.endsWith(".yml")) {
      file += ".yaml";
    }
    return file;
  }

  async setupAgent(firstArg, flags) {
    // Load .env file into process.env for CLI usage
    require("dotenv").config();

    // Create the agent only when actually needed
    const TestDriverAgent = require("../../../agent/index.js");

    let args;
    if (this.id === "generate") {
      // For generate command, the first parameter is a prompt, not a file
      args = firstArg ? [firstArg] : [];
    } else {
      // For run and other commands, handle file path
      const filePath = this.id === "run" && flags.path ? flags.path : firstArg;
      args = filePath ? [filePath] : [];
    }

    // Prepare CLI args for the agent with all derived options
    const cliArgs = {
      command: this.id,
      args,
      options: {
        ...flags,
        resultFile:
          flags.summary && typeof flags.summary === "string"
            ? path.resolve(flags.summary)
            : null,
      },
    };

    // Create agent with explicit process.env and consolidated CLI args
    this.agent = new TestDriverAgent(process.env, cliArgs);
    this.setupEventListeners();

    try {
      // Start the agent's initialization
      await this.agent.start();
    } catch (e) {
      console.error("Failed to start agent:", e);
      this.agent.emitter.emit(
        events.error.fatal,
        "Failed to start agent: " + JSON.stringify(e),
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
      // Create a temporary agent for definition purposes with empty environment
      const tempAgent = { workingDir: process.cwd() };
      return createCommandDefinitions(tempAgent)[commandName];
    }
    const definitions = createCommandDefinitions(this.agent);
    return definitions[commandName];
  }
}

module.exports = BaseCommand;
