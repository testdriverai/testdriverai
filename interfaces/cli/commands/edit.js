const { Args, Flags } = require("@oclif/core");

const BaseCommand = require("../lib/base.js");
const ReadlineInterface = require("../../readline.js");
class EditCommand extends BaseCommand {
  static description = "Edit a test file interactively";

  static args = {
    file: Args.string({
      description: "Test file to edit",
      default: "testdriver/testdriver.yaml",
      required: false,
    }),
  };

  static flags = {
    heal: Flags.boolean({
      description: "Enable automatic error recovery mode",
      default: false,
    }),
    headless: Flags.boolean({
      description: "Run in headless mode",
      default: false,
    }),
    "new-sandbox": Flags.boolean({
      description: "Create a new sandbox instance",
      default: false,
    }),
    sandbox: Flags.string({
      description: "Connect to existing sandbox with ID",
    }),
    summary: Flags.string({
      description: "Specify output file for summarize results",
    }),
  };

  async run() {
    const { args, flags } = await this.parse(EditCommand);

    await this.setupAgent(args.file, flags);

    // Build environment for edit mode with timeout
    const buildEnvPromise = this.agent.buildEnv(flags);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Environment setup timed out after 5 minutes")),
        300000,
      );
    });

    await Promise.race([buildEnvPromise, timeoutPromise]);

    // Start interactive mode
    const readlineInterface = new ReadlineInterface(this.agent);
    this.agent.readlineInterface = readlineInterface;
    await readlineInterface.start();
  }
}

module.exports = EditCommand;
