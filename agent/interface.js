const path = require("path");
const { Args, Flags } = require('@oclif/core');

/**
 * Creates command definitions using oclif format as the single source of truth
 * @param {Object} agent - The TestDriverAgent instance
 * @returns {Object} Command definitions object in oclif format
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
      args: {
        file: Args.string({
          description: 'Test file to run',
          default: 'testdriver/testdriver.yaml',
          required: false,
        }),
      },
      flags: {
        heal: Flags.boolean({
          description: 'Enable automatic error recovery mode',
          default: false,
        }),
        write: Flags.boolean({
          description: 'Save AI modifications to the test file',
          default: false,
        }),
        exit: Flags.boolean({
          description: 'Exit after completion',
          default: false,
        }),
        headless: Flags.boolean({
          description: 'Run in headless mode (no GUI)',
          default: false,
        }),
        'new-sandbox': Flags.boolean({
          description: 'Do not reuse the last sandbox, always create a new one',
          default: false,
        }),
        sandbox: Flags.string({
          description: 'Connect to existing sandbox with ID',
        }),
        summary: Flags.string({
          description: 'Specify output file for summarize results',
        }),
        config: Flags.string({
          description: 'Configuration file path',
        }),
        path: Flags.string({
          description: 'Path pattern for test files',
        }),
      },
      handler: async (args, flags) => {
        const file = normalizeFilePath(args.file);
        await agent.runLifecycle("prerun");
        await agent.run(file, flags.write, flags.exit !== false, true);
      },
    },

    edit: {
      description: "Edit a test file interactively",
      args: {
        file: Args.string({
          description: 'Test file to edit',
          default: 'testdriver/testdriver.yaml',
          required: false,
        }),
      },
      flags: {
        heal: Flags.boolean({
          description: 'Enable automatic error recovery mode',
          default: false,
        }),
        headless: Flags.boolean({
          description: 'Run in headless mode',
          default: false,
        }),
        'new-sandbox': Flags.boolean({
          description: 'Create a new sandbox instance',
          default: false,
        }),
        sandbox: Flags.string({
          description: 'Connect to existing sandbox with ID',
        }),
        summary: Flags.string({
          description: 'Specify output file for summarize results',
        }),
      },
      handler: async () => {
        // Note: Edit mode is handled by the CLI interface, not the unified command system
        throw new Error("Edit mode should be handled by CLI interface");
      },
    },

    sandbox: {
      description: "Manage sandbox instances",
      args: {
        action: Args.string({
          description: 'Action to perform (create, connect, list, destroy)',
          required: false,
        }),
      },
      flags: {
        id: Flags.string({
          description: 'Sandbox ID for connect/destroy operations',
        }),
        headless: Flags.boolean({
          description: 'Run in headless mode',
          default: false,
        }),
        list: Flags.boolean({
          description: 'List available sandbox instances',
          default: false,
        }),
        create: Flags.boolean({
          description: 'Create a new sandbox instance',
          default: false,
        }),
        destroy: Flags.string({
          description: 'Destroy sandbox by ID',
        }),
        connect: Flags.string({
          description: 'Connect to sandbox by ID',
        }),
      },
      handler: async (args, flags) => {
        await agent.sandboxCommand(args.action, flags);
      },
    },

    // Interactive commands that can be used within edit mode
    explore: {
      description: "Explore and interact with the current environment",
      args: {
        prompt: Args.string({
          description: 'What you want to explore or do',
          required: false,
        }),
      },
      flags: {},
      handler: async (args) => {
        await agent.exploratoryLoop(args.prompt || "", false, true, true);
      },
    },

    save: {
      description: "Save the current test script",
      args: {
        filename: Args.string({
          description: 'Optional filename to save to',
          required: false,
        }),
      },
      flags: {},
      handler: async (args) => {
        await agent.save(args.filename);
      },
    },

    exit: {
      description: "Exit the TestDriver agent",
      args: {},
      flags: {},
      handler: async () => {
        await agent.exit(false);
      },
    },

    help: {
      description: "Show help information",
      args: {},
      flags: {},
      handler: async () => {
        agent.showHelp();
      },
    },

    clear: {
      description: "Clear the terminal screen",
      args: {},
      flags: {},
      handler: async () => {
        process.stdout.write("\x1b[2J\x1b[0f");
      },
    },

    screenshot: {
      description: "Take a screenshot of the current screen",
      args: {},
      flags: {},
      handler: async () => {
        await agent.takeScreenshot();
      },
    },

    summarize: {
      description: "Summarize the current test script",
      args: {},
      flags: {},
      handler: async () => {
        await agent.summarize();
      },
    },

    history: {
      description: "Show command history",
      args: {},
      flags: {},
      handler: async () => {
        agent.showHistory();
      },
    },

    tasks: {
      description: "Show current tasks",
      args: {},
      flags: {},
      handler: async () => {
        agent.showTasks();
      },
    },

    version: {
      description: "Show version information",
      args: {},
      flags: {},
      handler: async () => {
        const packageJson = require("../package.json");
        console.log(`TestDriver.ai v${packageJson.version}`);
      },
    },
  };
}

module.exports = { createCommandDefinitions };
