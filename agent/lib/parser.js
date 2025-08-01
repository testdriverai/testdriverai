// parses markdown content to find code blocks, and then extracts yaml from those code blocks
const Parser = require("markdown-parser");
const yaml = require("js-yaml");
const Ajv = require("ajv/dist/2020");
const theme = require("./theme");
const { events } = require("../events.js");

let parser = new Parser();

function formatAjvError(error) {
  return [
    theme.red("Validation Failure"),
    `${theme.yellow("Path:")}      ${theme.white(error.instancePath)}`,
    `${theme.yellow("Schema:")}    ${theme.cyan(error.schemaPath)}`,
    `${theme.yellow("Keyword:")}   ${theme.magenta(error.keyword)}`,
    error.params?.missingProperty
      ? `${theme.yellow("Missing:")}   ${theme.yellow(
          error.params.missingProperty,
        )}`
      : "",
    `${theme.yellow("Message:")}   ${theme.white(error.message)}`,
    `\n`,
  ]
    .filter(Boolean)
    .join("\n");
}

// use markdown parser to find code blocks within AI response
const findCodeBlocks = async function (markdownContent) {
  let md = markdownContent.match(/```yaml\n([\s\S]*?)```/);

  if (md) {
    return [{ code: md[1] }];
  } else {
    return [];
  }
};

// use markdown parser to find code blocks within AI response
const findGenerativePrompts = async function (markdownContent) {
  return new Promise((resolve, reject) => {
    parser.parse(markdownContent, async (err, result) => {
      if (err) {
        return reject(err);
      }

      // parse the markdown content of each code block
      let codes = result.codes.map((code) => {
        return new Promise((resolve2, reject2) => {
          try {
            const yamlContent = getYAMLFromCodeBlock(code);
            const parsedYaml = parseYAML(yamlContent);
            resolve2(parsedYaml);
          } catch (err) {
            reject2(err);
          }
        });
      });

      // use Promise.all to wait for all the promises to resolve
      let parsedCodes = await Promise.all(codes);

      return resolve(parsedCodes);
    });
  });
};

// parse the yml from the included codeblock and clean it up
const getYAMLFromCodeBlock = function (codeblock) {
  let lines = codeblock.code.split("\n");

  // if first line is yaml or yml, remove it
  if (lines[0].indexOf("yaml") > -1 || lines[0].indexOf("yml") > -1) {
    lines.shift();
  }

  // count the whitespace in each line, and remove the line if it's all whitespace
  lines = lines.filter((line) => {
    return line.trim().length > 0 && line.trim()[0] !== ",";
    // sometimes it produces yaml with breaks, or just a single comma
  });

  return lines.join("\n");
};

// do the actual parsing
// this library is very strict
// note that errors are sent to the AI will it may self-heal
const parseYAML = async function (inputYaml) {
  let doc = await yaml.load(inputYaml);
  return doc;
};

// Replace ${VAR} with the value from the vars object
// Will skip variables that are not in the vars object
// Will skip escaped variables like \${VAR}
function interpolate(yaml, vars) {
  let newyaml = yaml;
  Object.keys(vars).forEach((key) => {
    newyaml = newyaml.replace(
      new RegExp(`(?<!\\\\)\\$\\{${key}\\}`, "g"),
      vars[key],
    );
  });
  // Replace \$ with $
  newyaml = newyaml.replace(/\\(\${[^}]+})/g, "$1");

  return newyaml;
}

// Function to gather all variables in the YAMl that have not been replaced
function collectUnreplacedVariables(yaml) {
  let unreplaced = [];

  // Use a regex to find all ${VAR} patterns
  const regex = /\$\{([^}]+)\}/g;
  let match;
  while ((match = regex.exec(yaml)) !== null) {
    const variable = match[1];
    // Check if the variable is already in the unreplaced array
    if (!unreplaced.includes(variable)) {
      unreplaced.push(variable);
    }
  }

  return unreplaced;
}

// Factory function to create parser with emitter
function createParser(emitter) {
  // validate yaml using schema.json in root
  let schema = require("../../schema.json");
  const validateYAML = async function (yaml) {
    let ajv = new Ajv({
      allowUnionTypes: true,
      strict: false,
    });
    let validate = ajv.compile(schema);
    let valid = validate(await parseYAML(yaml));

    if (!valid) {
      validate.errors.forEach((err) => {
        const formattedError = formatAjvError(err);
        emitter.emit(events.error.fatal, formattedError);
      });
      // throw new Error("Invalid YAML");
    }

    return yaml;
  };

  return {
    findCodeBlocks,
    findGenerativePrompts,
    getYAMLFromCodeBlock,
    interpolate,
    collectUnreplacedVariables,
    validateYAML,
    getCommands: async function (codeBlock) {
      const yml = getYAMLFromCodeBlock(codeBlock);
      let yamlArray = await parseYAML(yml);

      let steps = yamlArray?.steps;

      if (steps) {
        let commands = [];

        // combine them all as if they were a single step
        steps.forEach((s) => {
          commands = commands.concat(s.commands);
        });

        // filter undefined values
        commands = commands.filter((r) => {
          return r;
        });

        if (!commands.length) {
          throw new Error(
            "No actions found in yaml. Individual commands must be under the `commands` key.",
          );
        }

        return commands;
      } else {
        let commands = yamlArray?.commands;

        if (!commands?.length) {
          throw new Error(
            "No actions found in yaml. Individual commands must be under the `commands` key.",
          );
        }

        return commands;
      }
    },
  };
}

// Export both the factory function and the static functions for backward compatibility
module.exports = {
  createParser,
  // Static exports for backward compatibility
  findCodeBlocks,
  findGenerativePrompts,
  getYAMLFromCodeBlock,
  interpolate,
  collectUnreplacedVariables,
};
