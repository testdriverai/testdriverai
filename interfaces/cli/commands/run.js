const { Args, Flags } = require("@oclif/core");
const BaseCommand = require("../lib/base.js");

class RunCommand extends BaseCommand {
  static description = "Run a test file";

  static args = {
    file: Args.string({
      description: "Test file to run",
      default: "testdriver/testdriver.yaml",
      required: false,
    }),
  };

  static flags = {
    heal: Flags.boolean({
      description: "Enable automatic error recovery mode",
      default: false,
    }),
    write: Flags.boolean({
      description: "Save AI modifications to the test file",
      default: false,
    }),
    exit: Flags.boolean({
      description: "Exit after completion",
      default: false,
    }),
    headless: Flags.boolean({
      description: "Run in headless mode (no GUI)",
      default: false,
    }),
    "new-sandbox": Flags.boolean({
      description: "Do not reuse the last sandbox, always create a new one",
      default: false,
    }),
    sandbox: Flags.string({
      description: "Connect to existing sandbox with ID",
    }),
    summary: Flags.string({
      description: "Specify output file for summarize results",
    }),
    config: Flags.string({
      description: "Configuration file path",
    }),
    path: Flags.string({
      description: "Path pattern for test files",
    }),
  };

  async run() {
    const { args, flags } = await this.parse(RunCommand);

    console.log('DEBUG: args.file =', args.file);
    console.log('DEBUG: process.argv =', process.argv);

    await this.setupAgent(args.file, flags);

    // Set error limit higher for run command
    this.agent.errorLimit = 100;

    // Build environment for run mode
    await this.agent.buildEnv(flags);

    // Execute the run command directly
    const file = this.normalizeFilePath(args.file);
    console.log('DEBUG: normalized file =', file);
    console.log('DEBUG: agent.thisFile =', this.agent.thisFile);
    await this.agent.runLifecycle("prerun");
    await this.agent.run(file, flags.write, flags.exit !== false, true);
  }
}

module.exports = RunCommand;
