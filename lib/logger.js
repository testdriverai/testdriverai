// central logger for the bot
const winston = require("winston");
const os = require("os");
const { server } = require("./ipc");

// simple match for aws instance i-*
const shouldLog =
  os.hostname().indexOf("i-") == 0 || process.env["VERBOSE"] == "true";

// responsible for rendering ai markdown output
const { marked } = require("marked");
const { markedTerminal } = require("marked-terminal");
const { config } = require("dotenv");

const { printf } = winston.format;

const logFormat = printf(({ message }) => {
  return `${message}`;
});

let interpolationVars = JSON.parse(process.env.TD_INTERPOLATION_VARS || '{}');

// this handles local `TD_*` variables
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith("TD_") && key !== "TD_INTERPOLATION_VARS") {
    interpolationVars[key] = value;
  }
}

const censorSensitiveData = (message) => {
  for (let value of Object.values(interpolationVars)) {

    // Avoid replacing vars that are 0 or 1 character
    if (value.length >= 2) {
      message = message.replaceAll(value, "****");
    }
  }
  return message;
}

const logger = winston.createLogger({
  level: shouldLog ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.splat(),
    winston.format((info) => {
      info.message = censorSensitiveData(info.message);
      return info;
    })(),
    logFormat
  ),
  transports: [
    new winston.transports.Console(),
  ],
});


// marked is a markdown parser
// markedTerminal allows us to render markdown in CLI
marked.use(
  markedTerminal({
    width: 58, // 58 is the width of the terminal output on a 16" macbook pro
    reflowText: true,
    tab: 0,
  }),
);

const spaceChar = "    ";

const markedParsePartial = (markdown, start = 0, end = 0) => {
  let result = markdown.trimEnd().split("\n").slice(start, end);
  if (end <= 0) {
    end = result.length + end;
  }
  result = result.join("\n");

  return marked.parse(result).replace(/^/gm, spaceChar).trimEnd();
};

const createMarkdownStreamLogger = () => {
  let buffer = "";

  return {
    log: (chunk) => {
      if (typeof chunk !== "string") {
        return;
      }

      server.broadcast("output", chunk);

      const previousConsoleOutput = markedParsePartial(buffer, 0, -1);

      buffer += chunk;

      const consoleOutput = markedParsePartial(buffer, 0, -1);

      let diff = consoleOutput.replace(previousConsoleOutput, "");
      if (diff) {
        diff = censorSensitiveData(diff);
        process.stdout.write(diff);
      }
    },
    end() {

      const previousConsoleOutput = markedParsePartial(buffer, 0, -1);
      const consoleOutput = markedParsePartial(buffer, 0, Infinity);
      let diff = consoleOutput.replace(previousConsoleOutput, "");

      if (diff) {
        diff = censorSensitiveData(diff);
        process.stdout.write(diff);
      }
      process.stdout.write("\n\n");
      buffer = "";
    },
  };
};

const prettyMarkdown = (markdown) => {
  if (typeof markdown !== "string") {
    logger.error("prettyMarkdown requires a string");
    logger.error(markdown);
    return;
  }

  let consoleOutput = marked.parse(markdown);

  // strip newlines at end of consoleOutput
  consoleOutput = consoleOutput.replace(/\n$/, "");
  consoleOutput = consoleOutput.replace(/^/gm, spaceChar);

  logger.info(consoleOutput);
};

module.exports = {
  logger,
  prettyMarkdown,
  createMarkdownStreamLogger,
};

