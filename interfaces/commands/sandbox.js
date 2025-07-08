const { Args, Flags } = require("@oclif/core");
const BaseCommand = require("../base-command.js");

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

    await this.setupAgent(null, flags);

    // Execute the sandbox command through the unified command system
    await this.agent.executeUnifiedCommand("sandbox", [args.action], flags);
  }
}

module.exports = SandboxCommand;
