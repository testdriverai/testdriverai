// parses markdown content to find code blocks, and then extracts yaml from those code blocks
import Parser from 'markdown-parser';
import yaml from 'js-yaml';

const parser = new Parser();

// use markdown parser to find code blocks within AI response
const findCodeBlocks = async function (markdownContent) {
  return new Promise((resolve, reject) => {
    parser.parse(markdownContent, (err, result) => {
      if (err) {
        return reject(err);
      }

      let codes = result.codes.filter((code) => {
        return code.code.indexOf("yml") > -1 || code.code.indexOf("yaml") > -1;
      });

      return resolve(codes);
    });
  });
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
          parser.parse(code.code, (err, result) => {
            if (err) {
              reject2(err);
            } else {
              resolve2(result);
            }
          });
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
function interpolate (yaml, vars) {
  let newyaml = yaml;
  Object.keys(vars).forEach((key) => {
    newyaml = newyaml.replace(new RegExp(`(?<!\\\\)\\$\\{${key}\\}`, "g"), vars[key]);
  });
  // Replace \$ with $
  newyaml = newyaml.replace(/\\(\${[^}]+})/g, "$1");
  return newyaml;
}

async function getCommands(codeBlock) {
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
}

export {
  findCodeBlocks,
  findGenerativePrompts,
  getYAMLFromCodeBlock,
  interpolate,
  getCommands,
};
