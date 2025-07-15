#!/usr/bin/env node

const { Command, Args, Flags } = require("@oclif/core");

class TestCommand extends Command {
  static description = "Test command";

  static args = {
    file: Args.string({
      description: "Test file to run",
      default: "test.yaml",
      required: false,
    }),
  };

  static flags = {
    test: Flags.boolean({
      description: "Test flag",
      default: false,
    }),
  };

  async run() {
    const { args, flags } = await this.parse(TestCommand);
    console.log("Parsed args:", args);
    console.log("Parsed flags:", flags);
  }
}

TestCommand.run();
