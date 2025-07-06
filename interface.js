const path = require("path");
const commander = require("./lib/commander.js");
const logger = require("./lib/logger.js").logger;

/**
 * Creates command definitions for the TestDriver agent
 * @param {Object} agent - The TestDriverAgent instance
 * @returns {Object} Command definitions object
 */
function createCommandDefinitions(agent) {
  const normalizeFilePath = (file) => {
    if (!file) {
      file = "testdriver/testdriver.yaml";
    }

    file = path.join(agent.workingDir, file);
    if (!file.endsWith(".yaml") && !file.endsWith(".yml")) {
      file += ".yaml";
    }

    return file;
  };

  return {
    run: {
      description: "Run a test file",
      arguments: [
        {
          name: "file",
          description: "Test file to run",
          optional: true,
          default: "testdriver/testdriver.yaml",
        },
      ],
      options: [
        {
          name: "heal",
          description: "Enable automatic error recovery mode",
          type: "boolean",
        },
        {
          name: "write",
          description: "Save AI modifications to the test file",
          type: "boolean",
        },
        {
          name: "exit",
          description: "Exit after completion",
          type: "boolean",
        },
        {
          name: "headless",
          description: "Run in headless mode (no GUI)",
          type: "boolean",
        },
        {
          name: "sandbox",
          description: "Connect to existing sandbox with ID",
          type: "string",
        },
        {
          name: "summary",
          description: "Specify output file for summarize results",
          type: "string",
        },
        {
          name: "new-sandbox",
          description: "Do not reuse the last sandbox, always create a new one",
          type: "boolean",
        },
      ],
      handler: async (args, options) => {
        if (options.heal) agent.healMode = true;
        if (options.sandbox) agent.sandboxId = options.sandbox;
        if (options["new-sandbox"]) agent.newSandbox = true;

        const file = normalizeFilePath(args.file);
        await agent.runLifecycle("prerun");
        await agent.run(file, options.write, options.exit !== false, true);
      },
    },

    edit: {
      description: "Edit a test file interactively",
      arguments: [
        {
          name: "file",
          description: "Test file to edit",
          optional: true,
          default: "testdriver/testdriver.yaml",
        },
      ],
      options: [
        {
          name: "heal",
          description: "Enable automatic error recovery mode",
          type: "boolean",
        },
        {
          name: "sandbox",
          description: "Connect to existing sandbox with ID",
          type: "string",
        },
        {
          name: "summary",
          description: "Specify output file for summarize results",
          type: "string",
        },
        {
          name: "new-sandbox",
          description: "Do not reuse the last sandbox, always create a new one",
          type: "boolean",
        },
      ],
      handler: async (args, options) => {
        if (options.heal) agent.healMode = true;
        if (options.sandbox) agent.sandboxId = options.sandbox;
        if (options["new-sandbox"]) agent.newSandbox = true;

        const file = normalizeFilePath(args.file);
        // Set the file but don't run it - edit mode starts interactive session
        agent.thisFile = file;
        if (options.summary) agent.resultFile = path.resolve(options.summary);
      },
    },

    sandbox: {
      description: "Manage sandbox instances",
      options: [
        {
          name: "list",
          description: "List all sandbox instances",
          type: "boolean",
        },
        {
          name: "destroy",
          description: "Destroy a sandbox instance by ID",
          type: "string",
        },
        {
          name: "create",
          description: "Create a new sandbox instance",
          type: "boolean",
        },
      ],
      handler: async (args, options) => {
        await agent.handleSandboxCommand(options);
        process.exit(0);
      },
    },

    summarize: {
      description: "Summarize the current test session",
      arguments: [
        {
          name: "file",
          description: "Output file for summary",
          optional: true,
        },
      ],
      handler: async (args) => {
        if (args.file) {
          const originalResultFile = agent.resultFile;
          agent.resultFile = path.resolve(args.file);
          await agent.summarize();
          agent.resultFile = originalResultFile;
        } else {
          await agent.summarize();
        }
      },
    },

    save: {
      description: "Save the current test session",
      arguments: [
        { name: "file", description: "File to save to", optional: true },
      ],
      handler: async (args) => {
        await agent.save({ filepath: args.file });
      },
    },

    quit: {
      description: "Quit the application",
      handler: async () => {
        await agent.exit(false, true);
      },
    },

    undo: {
      description: "Undo the last command",
      handler: async () => {
        await agent.undo();
      },
    },

    assert: {
      description: "Assert a condition",
      arguments: [
        {
          name: "condition",
          description: "Condition to assert",
          variadic: true,
        },
      ],
      handler: async (args) => {
        await agent.assert(args.condition.join(" "));
      },
    },

    manual: {
      description: "Input manual command",
      arguments: [
        {
          name: "command",
          description: "Manual command to input",
          variadic: true,
        },
      ],
      handler: async (args) => {
        await agent.manualInput(args.command.join(" "));
      },
    },

    generate: {
      description: "Generate test files",
      arguments: [
        { name: "type", description: "Type of test to generate" },
        { name: "count", description: "Number of tests to generate" },
        { name: "baseYaml", description: "Base YAML file", optional: true },
        { name: "skipYaml", description: "Skip YAML flag", optional: true },
      ],
      handler: async (args) => {
        const skipYaml = args.skipYaml === "--skip-yaml";
        await agent.generate(args.type, args.count, args.baseYaml, skipYaml);
      },
    },

    dry: {
      description: "Run in dry mode",
      arguments: [
        {
          name: "prompt",
          description: "Prompt to run in dry mode",
          variadic: true,
        },
      ],
      handler: async (args) => {
        await agent.exploratoryLoop(args.prompt.join(" "), true, false);
      },
    },

    yaml: {
      description: "Run raw YAML",
      arguments: [{ name: "yaml", description: "YAML content to run" }],
      handler: async (args) => {
        await agent.runRawYML(args.yaml);
      },
    },

    exec: {
      description: "Execute a command",
      arguments: [
        {
          name: "command",
          description: "Command to execute",
          variadic: true,
        },
      ],
      handler: async (args) => {
        let result = await commander.run({
          command: "exec",
          cli: args.command.join(" "),
        });
        if (result.out) {
          logger.info(result.out.stdout);
        } else if (result.error) {
          logger.error(result.error.result.stdout);
        }
      },
    },
  };
}

module.exports = { createCommandDefinitions };
