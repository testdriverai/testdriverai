// parses markdown content to find code blocks, and then extracts yaml from those code blocks
const yaml = require("js-yaml");
const pkg = require("../../package.json");
const session = require("./session");
const theme = require("./theme");
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
        return `${theme.cyan(key)}=${theme.green(value)}`;
      } else {
        return `${key}=${value}`;
      }
    })
    .join(" ");

  return params;
};

const dumpToYML = async function (inputArray, sessionInstance = null) {
  // use yml dump to convert json to yml
  let yml = await yaml.dump({
    version: pkg.version,
    session: sessionInstance ? sessionInstance.get() : session.get(),
    steps: inputArray,
  });

  return yml;
};

const hydrateFromYML = async function (yml, sessionInstance = null) {
  // use yml load to convert yml to json
  let json = await yaml.load(yml);

  if (!json) {
    json = {};
  }

  const sessionToUse = sessionInstance || session;

  if (!json?.session) {
    json.session = sessionToUse.get();
  }

  sessionToUse.set(json.session);

  return json;
};

module.exports = {
  manualToYml,
  dumpToYML,
  hydrateFromYML,
  jsonToManual,
};
