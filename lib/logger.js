// central logger for the bot
import winston from 'winston';
import os from 'os';
import stripAnsi from '@electerm/strip-ansi';
import packageJson from '../package.json';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';

// simple match for aws instance i-*
const shouldLog =
  os.hostname().indexOf("i-") == 0 || process.env["VERBOSE"] == "true";

let depth = 0;
const setDepth = (d) => {
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

      const previousConsoleOutput = markedParsePartial(buffer, 0, -1);

      buffer += chunk;

      const consoleOutput = markedParsePartial(buffer, 0, -1);

      const diff = consoleOutput.replace(previousConsoleOutput, "");
      if (diff) {
        process.stdout.write(diff);
      }
    },
    end() {
      const previousConsoleOutput = markedParsePartial(buffer, 0, -1);
      const consoleOutput = markedParsePartial(buffer, 0, Infinity);
      const diff = consoleOutput.replace(previousConsoleOutput, "");

      if (diff) {
        process.stdout.write(diff);
      }
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
      version: packageJson.version,
    });
  }
};

export default {
  log,
  setDepth,
  prettyMarkdown,
  createMarkdownStreamLogger,
};
