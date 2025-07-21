const chalk = require("chalk");
chalk.level = 3; // Force color outputs when using chalk, was added for VS Code support

module.exports = {
  green: chalk.hex("#b3d334"),
  blue: chalk.hex("#34a3d3"),
  red: chalk.hex("#d33434"),
  yellow: chalk.hex("#ced334"),
  magenta: chalk.hex("#d334b3"),
  cyan: chalk.hex("#34d3d3"),
  dim: chalk.dim,
  gray: chalk.gray,
  white: chalk.white,
};
