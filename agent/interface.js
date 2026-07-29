const { Args, Flags } = require("@oclif/core");

/**
 * Creates command definitions using oclif format as the single source of truth
 * @param {Object} agent - The TestDriverAgent instance
 * @returns {Object} Command definitions object in oclif format
 */
function createCommandDefinitions(agent) {
  return {
    init: {
      description: "Initialize a new TestDriver project with Vitest SDK examples",
      args: {},
      flags: {
        client: Flags.string({
          description:
            "AI client(s) to install into (comma-separated, or 'all'). e.g. --client claude-code,cursor. Omit for an interactive picker.",
          multiple: false,
        }),
        "sample-test": Flags.boolean({
          description:
            "Scaffold the example test files (tests/example.test.js + tests/login.js). Use --no-sample-test to skip them (e.g. when an agent writes its own tests).",
          default: true,
          allowNo: true,
        }),
      },
      handler: async () => {
        // This handler is special - it doesn't need an agent instance
        // It just scaffolds files, so it will be handled by the CLI command
        throw new Error("Init mode should be handled by CLI interface");
      },
    },

    "setup": {
      description:
        "Set up TestDriver skills, agents, and MCP server for Claude Code",
      args: {},
      flags: {},
      handler: async () => {
        throw new Error(
          "setup should be handled by CLI interface",
        );
      },
    },
  };
}

module.exports = { createCommandDefinitions };
