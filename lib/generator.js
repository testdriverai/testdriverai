// parses markdown content to find code blocks, and then extracts yaml from those code blocks
const yaml = require("js-yaml");
const chalk = require("chalk");
const package = require("../package.json");
const fs = require("fs");
// do the actual parsing
// this library is very strict
// note that errors are sent to the AI will it may self-heal
const manualToYml = async function (inputArgs) {
  // input is like `command=click x=100 y=200 z='this is a string'`
  // convert this to json

  const pattern = /(\w+)=('[^']*'|[^\s]+)/g;

  let match;
  let json = {};

  while ((match = pattern.exec(inputArgs)) !== null) {
    const key = match[1];
    const value = match[2].replace(/'/g, ""); // Remove single quotes if present
    json[key] = value;
  }

  json = {
    commands: [json],
  };

  // use yml dump to convert json to yml
  let yml = await yaml.dump(json);

  return yml;
};

const jsonToManual = function (json, colors = true) {
  // Convert the JSON object to key-value pairs
  const params = Object.keys(json)
    .map((key) => {
      let value = json[key];

      // If the value contains spaces, wrap it in single quotes
      if (typeof value === "string") {
        value = `'${value}'`;
      }

      if (colors) {
        return `${chalk.cyan.dim(key)}=${chalk.green.dim(value)}`;
      } else {
        return `${key}=${value}`;
      }
    })
    .join(" ");

  return params;
};

function getLastCommentLine(file) {
  const yml = fs.readFileSync(file, "utf8");
  const lines = yml.split("\n");
  let lastCommentLine = -1;
  lines.forEach((line, index) => {
    if (line.trim().startsWith("#")) {
      lastCommentLine = index;
    }
  });
  return lastCommentLine;
}

function ymlWithComments(file, yml) {
  const lastCommentLine = getLastCommentLine(file);
  if (lastCommentLine === -1) {
    return yml;
  } else {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    const ymlLines = yml.split("\n");
    lines[0] = ymlLines[0]; // replace the version line with the current version
    ymlLines.shift(); // remove the version line
    ymlLines.shift(); // remove the steps line

    lines.splice(
      lastCommentLine + 1,
      lines.length - (lastCommentLine + 1),
      ...ymlLines,
    );
    return lines.join("\n");
  }
}

const historyToYml = async function (inputArray) {
  // use yml dump to convert json to yml
  let yml = await yaml.dump({
    version: package.version,
    steps: inputArray,
  });

  return yml;
};

const ymlToHistory = async function (yml) {
  // use yml load to convert yml to json
  let json = await yaml.load(yml);
  return json;
};

module.exports = {
  manualToYml,
  ymlWithComments,
  historyToYml,
  ymlToHistory,
  jsonToManual,
};
