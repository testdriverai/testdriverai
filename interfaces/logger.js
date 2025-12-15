// central logger for the bot
const winston = require("winston");
const chalk = require("chalk");
const theme = require("../agent/lib/theme");
const Transport = require("winston-transport");
const { events } = require("../agent/events");
class CustomTransport extends Transport {
  constructor(opts) {
    super(opts);
    this.name = opts.name || "customTransport";
    this.level = opts.level || "info";
    this.logStore = opts.logStore || []; // You could connect to a DB or API here
    this.sandbox = null;
  }

  log(info, callback) {
    try {
      const { message } = info;

      if (!this.sandbox) {
        this.sandbox = require("../agent/lib/sandbox");
      }

      if (this.sandbox && this.sandbox.instanceSocketConnected) {
        if (typeof message === "object") {
          console.log(chalk.cyan("protecting against base64 error"));
          console.log(message);
          return;
        }

        this.sandbox.send({
          type: "output",
          output: Buffer.from(message).toString("base64"),
        });
      }
    } catch (e) {
      console.error("Error in CustomTransport log method:", e);
    }

    callback();
  }
}

// responsible for rendering ai markdown output
const { marked } = require("marked");
const { markedTerminal } = require("marked-terminal");
const { censorSensitiveDataDeep } = require("../agent/lib/censorship");

const { printf } = winston.format;

const logFormat = printf(({ message }) => {
  return `${message}`;
});

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.splat(),
    winston.format((info) => {
      info.message = censorSensitiveDataDeep(info.message);
      return info;
    })(),
    logFormat,
  ),
  transports: [
    new winston.transports.Console(),
    new CustomTransport({
      level: "info",
      logStore: [], // You could pass an external store or leave it empty
    }),
  ],
});

const plain = (codePart) => codePart;

// marked is a markdown parser
// markedTerminal allows us to render markdown in CLI
marked.use(
  markedTerminal(
    {
      width: 58, // 58 is the width of the terminal output on a 16" macbook pro
      reflowText: true,
      tab: 2,
    },
    {
      theme: {
        /**
         * keyword in a regular Algol-style language
         */
        keyword: theme.blue,

        /**
         * built-in or library object (constant, class, function)
         */
        built_in: theme.cyan,

        /**
         * user-defined type in a language with first-class syntactically significant types, like
         * Haskell
         */
        type: theme.cyan,

        /**
         * special identifier for a built-in value ("true", "false", "null")
         */
        literal: theme.blue,

        /**
         * number, including units and modifiers, if any.
         */
        number: theme.green,

        /**
         * literal regular expression
         */
        regexp: theme.red,

        /**
         * literal string, character
         */
        string: theme.green,

        /**
         * parsed section inside a literal string
         */
        subst: plain,

        /**
         * symbolic constant, interned string, goto label
         */
        symbol: plain,

        /**
         * class or class-level declaration (interfaces, traits, modules, etc)
         */
        class: theme.blue,

        /**
         * function or method declaration
         */
        function: theme.yellow,

        /**
         * name of a class or a function at the place of declaration
         */
        title: plain,

        /**
         * block of function arguments (parameters) at the place of declaration
         */
        params: plain,

        /**
         * comment
         */
        comment: theme.green,

        /**
         * documentation markup within comments
         */
        doctag: theme.green,

        /**
         * flags, modifiers, annotations, processing instructions, preprocessor directive, etc
         */
        meta: theme.grey,

        /**
         * keyword or built-in within meta construct
         */
        "meta-keyword": plain,

        /**
         * string within meta construct
         */
        "meta-string": plain,

        /**
         * heading of a section in a config file, heading in text markup
         */
        section: plain,

        /**
         * XML/HTML tag
         */
        tag: theme.grey,

        /**
         * name of an XML tag, the first word in an s-expression
         */
        name: theme.blue,

        /**
         * s-expression name from the language standard library
         */
        "builtin-name": plain,

        /**
         * name of an attribute with no language defined semantics (keys in JSON, setting names in
         * .ini), also sub-attribute within another highlighted object, like XML tag
         */
        attr: theme.cyan,

        /**
         * name of an attribute followed by a structured value part, like CSS properties
         */
        attribute: plain,

        /**
         * variable in a config or a template file, environment var expansion in a script
         */
        variable: plain,

        /**
         * list item bullet in text markup
         */
        bullet: plain,

        /**
         * code block in text markup
         */
        code: plain,

        /**
         * emphasis in text markup
         */
        emphasis: chalk.italic,

        /**
         * strong emphasis in text markup
         */
        strong: chalk.bold,

        /**
         * mathematical formula in text markup
         */
        formula: plain,

        /**
         * hyperlink in text markup
         */
        link: chalk.underline,

        /**
         * quotation in text markup
         */
        quote: plain,

        /**
         * tag selector in CSS
         */
        "selector-tag": plain,

        /**
         * #id selector in CSS
         */
        "selector-id": plain,

        /**
         * .class selector in CSS
         */
        "selector-class": plain,

        /**
         * [attr] selector in CSS
         */
        "selector-attr": plain,

        /**
         * :pseudo selector in CSS
         */
        "selector-pseudo": plain,

        /**
         * tag of a template language
         */
        "template-tag": plain,

        /**
         * variable in a template language
         */
        "template-variable": plain,

        /**
         * added or changed line in a diff
         */
        addition: theme.green,

        /**
         * deleted line in a diff
         */
        deletion: theme.red,

        /**
         * things not matched by any token
         */
        default: plain,
      },
    },
  ),
);

const createMarkdownLogger = (emitter) => {
  const markedParsePartial = (markdown, start = 0, end = 0) => {
    let result = markdown.trimEnd().split("\n").slice(start, end);
    if (end <= 0) {
      end = result.length + end;
    }
    result = result.join("\n");

    return marked.parse(result).replace(/^/gm, spaceChar).trimEnd();
  };

  // Event-based markdown streaming with buffering
  const activeStreams = new Map();

  // Handle streaming markdown events with proper buffering
  emitter.on(events.log.markdown.start, (streamId) => {
    activeStreams.set(streamId, {
      buffer: "",
      lastOutput: "",
    });
  });

  emitter.on(events.log.markdown.chunk, (streamId, chunk) => {
    if (!activeStreams.has(streamId)) {
      return;
    }

    const stream = activeStreams.get(streamId);

    if (typeof chunk !== "string") {
      return;
    }

    const previousConsoleOutput = markedParsePartial(stream.buffer, 0, -1);

    stream.buffer += chunk;

    const consoleOutput = markedParsePartial(stream.buffer, 0, -1);

    let diff = consoleOutput.replace(previousConsoleOutput, "");
    if (diff) {
      diff = censorSensitiveDataDeep(diff);
      process.stdout.write(diff);
    }
  });

  emitter.on(events.log.markdown.end, (streamId) => {
    if (!activeStreams.has(streamId)) {
      return;
    }

    const stream = activeStreams.get(streamId);

    const previousConsoleOutput = markedParsePartial(stream.buffer, 0, -1);
    const consoleOutput = markedParsePartial(stream.buffer, 0, Infinity);
    let diff = consoleOutput.replace(previousConsoleOutput, "");

    if (diff) {
      diff = censorSensitiveDataDeep(diff);
      process.stdout.write(diff);
    }
    process.stdout.write("\n\n");

    // Clean up the stream
    activeStreams.delete(streamId);
  });

  // Handle static markdown logging (complete markdown blocks)
  emitter.on(events.log.markdown.static, (markdown) => {
    if (typeof markdown !== "string") {
      logger.error("Static markdown requires a string");
      logger.error(markdown);
      return;
    }

    let consoleOutput = marked.parse(markdown);

    // strip newlines at end of consoleOutput
    consoleOutput = consoleOutput.replace(/\n$/, "");
    consoleOutput = consoleOutput.replace(/^/gm, spaceChar);

    logger.info(consoleOutput);
  });
};

const spaceChar = "    ";

module.exports = {
  logger,
  createMarkdownLogger,
};
