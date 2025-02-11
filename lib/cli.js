/**
 * CLI Argument Parsing / Handling
 */

const { program }  = require("commander");
const package = require("../package.json");
const fs = require("fs");
const path = require("path");

// Default Testdriver yaml file
const DEFAULT_FILE = "testdriver/testdriver.yml";

/**
 * Parse the CLI Arguments.
 * @param {string[]} args - List of string arguments (usually process.argv).
 * @returns {Object} - An object containing the parsed command and file.
 */
const parseArgs = (args) => {
  let userCommand = "";
  let userFile = "";

  program
    .name("testdriverai")
    .description("Generate and edit testdriver yaml files")
    .version(package.version);

  program
    .command("init")
    .description("Initialize A testdriver YAML file")
    .argument("[file]", "File to use", DEFAULT_FILE)
    .action((file) => {
      userCommand = "init";
      userFile = file
    });

  program
    .command("run")
    .description("Run through a testdriver YAML file")
    .argument("[file]", "File to use", DEFAULT_FILE)
    .action((file) => {
      userCommand = "run";
      userFile = file
    });

  program
    .command("edit")
    .description("Append / Edit a testdriver YAML")
    .argument("[file]", "File to use", DEFAULT_FILE)
    .action((file) => {
      userCommand = "edit";
      userFile = file
    });

  // Default to "edit" if no subcommand is provided
  program
    .argument("[file]", "File to use", DEFAULT_FILE)
    .action((file) => {
      userCommand = "edit";
      userFile = file
    });
  program.parse(args);

    // Resolve to absolute path
  const resolvedPath = path.resolve(userFile);

  // Get parent directory
  const parentDir = path.dirname(resolvedPath);

  // Ensure parent directories exist
  fs.mkdirSync(parentDir, { recursive: true });

  // Enforce .yml extension
  if (!userFile.endsWith(".yml") && !userFile.endsWith(".yaml")) {
    userFile += ".yml";
  }

  return { command: userCommand, file: userFile }; 
};

module.exports = { parseArgs };
