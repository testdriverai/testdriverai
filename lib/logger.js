// central logger for the bot
const winston = require("winston");
const os = require("os");
const stripAnsi = require("@electerm/strip-ansi").default;
const package = require("../package.json");

// simple match for aws instance i-*
const shouldLog =
  os.hostname().indexOf("i-") == 0 || process.env["VERBOSE"] == "true";

// responsible for rendering ai markdown output
const { marked } = require("marked");
const { markedTerminal } = require("marked-terminal");

let depth = 0;
let setDepth = (d) => {
  depth = d - 1;
  if (depth < 0) {
    depth = 0;
  }
};

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

const markedParsePartial = (markdown) => {
  let result = marked
    .parse(markdown)
    .replace(/^/gm, spaceChar)
    .trimEnd()
    .split("\n");

  return result.length <= 1
    ? ""
    : result.slice(0, result.length - 1).join("\n");
};

const createMarkdownStreamLogger = () => {
  let buffer = "";
  return {
    log: (chunk) => {
      if (typeof chunk !== "string") {
        log("error", "markdownStreamLogger's log method requires a string");
        log("error", chunk);
        return;
      }

      let previousConsoleOutput = markedParsePartial(buffer);

      buffer += chunk;

      let consoleOutput = markedParsePartial(buffer);

      process.stdout.write(consoleOutput.replace(previousConsoleOutput, ""));
    },
    end() {
      let previousConsoleOutput = markedParsePartial(buffer);

      let consoleOutput = marked
        .parse(buffer)
        .replace(/^/gm, spaceChar)
        .trimEnd();

      process.stdout.write(consoleOutput.replace(previousConsoleOutput));
      process.stdout.write("\n\n");
      buffer = "";
      log("silly", consoleOutput);
    },
  };
};

const prettyMarkdown = (markdown) => {
  if (typeof markdown !== "string") {
    log("error", "prettyMarkdown requires a string");
    log("error", markdown);
    return;
  }

  let consoleOutput = marked.parse(markdown);

  // strip newlines at end of consoleOutput
  consoleOutput = consoleOutput.replace(/\n$/, "");
  consoleOutput = consoleOutput.replace(/^/gm, spaceChar);

  // note that this is logged 3 times:

  // datadog
  log("silly", consoleOutput);

  // user terminal
  console.log(consoleOutput);
};

const logger = winston.createLogger({
  transports: [],
});

if (shouldLog) {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
      level: "silly",
    }),
  );
}

const log = (level, message, indent = false) => {
  let m = message;

  if (indent) {
    m = spaceChar + message;
  }

  if (process.env["DEV"] || (level !== "silly" && level !== "debug")) {
    console.log(m);
  }

  if (typeof message === "string" || message instanceof String) {
    message = stripAnsi(message);
  } else {
    message = JSON.stringify(message);
  }

  if (shouldLog) {
    logger.log({
      level,
      message,
      version: package.version,
    });
  }
};

let loggy = {
  log,
  setDepth,
  prettyMarkdown,
  createMarkdownStreamLogger,
};

module.exports = loggy;
