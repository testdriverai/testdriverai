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

    // Use pattern matching for log events, but skip log:Debug
    this.agent.emitter.on("log:*", (message) => {
      const event = this.agent.emitter.event;

      if (event === events.log.debug) return;
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

  async setupAgent(file, flags) {
    // Load .env file into process.env for CLI usage
    require("dotenv").config();

    // Extract AWS properties if available
    const awsProperties = this.extractAWSProperties();

    // Create the agent only when actually needed
    const TestDriverAgent = require("../../../agent/index.js");

    // Use --path flag if provided, otherwise use the file argument
    const filePath = this.id === "run" && flags.path ? flags.path : file;

    // Prepare CLI args for the agent with all derived options
    const cliArgs = {
      command: this.id,
      args: [filePath], // Pass the resolved file path as the first argument
      options: {
        ...flags,
        resultFile:
          flags.summary && typeof flags.summary === "string"
            ? path.resolve(flags.summary)
            : null,
        // Include AWS properties for direct EC2 connection
        ...awsProperties,
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

  // Extract AWS properties for direct EC2 connection
  extractAWSProperties() {
    const { execSync } = require("child_process");
    const path = require("path");
    
    try {
      // Check if aws.sh exists and AWS environment variables are set
      const awsScriptPath = path.resolve(__dirname, "../../../aws.sh");
      if (!fs.existsSync(awsScriptPath)) {
        return {};
      }

      // Check for required AWS environment variables
      const requiredVars = ['AWS_REGION', 'AMI_ID', 'AWS_KEY_NAME', 'AWS_SECURITY_GROUP_IDS', 'AWS_IAM_INSTANCE_PROFILE'];
      const hasRequiredVars = requiredVars.every(varName => process.env[varName]);
      
      if (!hasRequiredVars) {
        return {};
      }

      console.log('🔍 Detecting AWS configuration, checking for direct EC2 connection...');
      
      // Execute aws.sh to get instance information
      const output = execSync(`bash "${awsScriptPath}"`, { 
        encoding: 'utf8',
        stdio: ['inherit', 'pipe', 'inherit'], // pipe stdout only
        env: process.env
      });

      // Parse JSON output (should be the last line)
      const lines = output.trim().split('\n');
      const jsonLine = lines[lines.length - 1];
      const awsInfo = JSON.parse(jsonLine);

      if (awsInfo.instanceId && awsInfo.publicIp) {
        console.log(`✅ AWS EC2 instance detected: ${awsInfo.instanceId} (${awsInfo.publicIp})`);
        
        // Return properties that will enable direct EC2 connection
        return {
          directMode: true,
          instanceId: awsInfo.instanceId,
          publicIp: awsInfo.publicIp,
          wsHost: awsInfo.ws?.host || awsInfo.publicIp,
          wsPort: awsInfo.ws?.port || 8080,
          awsInfo: awsInfo
        };
      }
    } catch (error) {
      // Silently fall back to regular sandbox connection if AWS setup fails
      console.log(`ℹ️  AWS setup not available (${error.message}), using standard sandbox connection`);
    }
    
    return {};
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
