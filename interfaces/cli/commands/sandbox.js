const { Args, Flags } = require("@oclif/core");
const BaseCommand = require("../lib/base.js");

class SandboxCommand extends BaseCommand {
  static description = "Manage sandbox instances";

  static args = {
    action: Args.string({
      description: "Action to perform (create, connect, list, destroy)",
      required: false,
    }),
  };

  static flags = {
    id: Flags.string({
      description: "Sandbox ID for connect/destroy operations",
    }),
    headless: Flags.boolean({
      description: "Run in headless mode",
      default: false,
    }),
    list: Flags.boolean({
      description: "List available sandbox instances",
      default: false,
    }),
    create: Flags.boolean({
      description: "Create a new sandbox instance",
      default: false,
    }),
    destroy: Flags.string({
      description: "Destroy sandbox by ID",
    }),
    connect: Flags.string({
      description: "Connect to sandbox by ID",
    }),
  };

  async run() {
    const { args, flags } = await this.parse(SandboxCommand);

    // Use a custom setup for sandbox since it doesn't use a file parameter
    await this.setupSandboxAgent(args.action, flags);
  }

  async setupSandboxAgent(action, flags) {
    // Create the agent only when actually needed
    if (!this.agent) {
      this.setupProcessHandlers();
    }
    const TestDriverAgent = require("../../../agent/index.js");
    this.agent = new TestDriverAgent();
    this.setupEventListeners();

    // Set up agent properties from CLI args - sandbox uses action instead of file
    this.agent.cliArgs = {
      command: this.id,
      args: [action],
      options: flags,
    };

    // Sandbox doesn't use thisFile, but set it to null
    this.agent.thisFile = null;

    // Start the agent's initialization
    await this.agent.start();
  }
}

module.exports = SandboxCommand;
