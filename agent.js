#!/usr/bin/env node

// disable depreciation warnings
process.removeAllListeners("warning");

// package.json is included to get the version number
const packageJson = require("./package.json");

// nodejs modules
const fs = require("fs");
const os = require("os");

// third party modules
const path = require("path");
const yaml = require("js-yaml");
const sanitizeFilename = require("sanitize-filename");
const { Command } = require("commander");
const { EventEmitter } = require("events");

// local modules
const server = require("./lib/ipc.js");
const speak = require("./lib/speak.js");
const analytics = require("./lib/analytics.js");
const parser = require("./lib/parser.js");
const commander = require("./lib/commander.js");
const system = require("./lib/system.js");
const generator = require("./lib/generator.js");
const sdk = require("./lib/sdk.js");
const commands = require("./lib/commands.js");
const config = require("./lib/config.js");
const sandbox = require("./lib/sandbox.js");
const theme = require("./lib/theme.js");
const log = require("./lib/logger.js");
const { createCommandDefinitions } = require("./interface.js");
const ReadlineInterface = require("./interfaces/readline.js");

const isValidVersion = require("./lib/valid-version.js");
const session = require("./lib/session.js");
const notify = require("./lib/notify.js");
const { events } = require("./lib/events.js");
const { createDebuggerProcess } = require("./lib/debugger.js");

const logger = log.logger;

class TestDriverAgent extends EventEmitter {
  constructor() {
    super();

    // these are "in-memory" globals
    // they represent the current state of the agent
    this.thisFile = null; // the file being run
    this.lastPrompt = ""; // the last prompt to be input
    this.executionHistory = []; // a history of commands run in the current session
    this.errorCounts = {}; // counts of different errors encountered in this session
    this.errorLimit = 3; // the max number of times an error can be encountered before exiting
    this.checkCount = 0; // the number of times the AI has checked the task
    this.checkLimit = 7; // the max number of times the AI can check the task before exiting
    this.lastScreenshot = null; // the last screenshot taken by the agent
    this.readlineInterface = null; // the readline interface for interactive mode
    this.resultFile = null; // the file to save results to, if specified
    this.newSandbox = false; // whether to create a new sandbox instance instead of reusing the last one
    this.tasks = []; // list of prompts that the user has given us
    this.healMode = false; // whether to enable automatic error recovery mode
    this.sandboxId = null; // the ID of the sandbox to connect to, if specified
    this.workingDir = process.cwd(); // working directory where this agent is running
    this.cliArgs = {}; // the cli args passed to the agent
    this.lastCommand = new Date().getTime();
    this.csv = [["command,time"]];

    // temporary file for command history
    this.commandHistoryFile = path.join(os.homedir(), ".testdriver_history");

    this.setupProcessHandlers();
  }

  setupProcessHandlers() {
    // Process error handlers
    process.on("uncaughtException", async (err) => {
      analytics.track("uncaughtException", { err });
      logger.error("Uncaught Exception: %s", err);
      // You might want to exit the process after handling the error
      await this.exit(true);
    });

    process.on("unhandledRejection", async (reason, promise) => {
      analytics.track("unhandledRejection", { reason, promise });
      logger.error("Unhandled Rejection at: %s, reason: %s", promise, reason);
      // Optionally, you might want to exit the process
      await this.exit(true);
    });
  }

  // parses the command line arguments using `commander` with unified command system
  parseArgs() {
    const program = new Command();

    program
      .name("testdriverai")
      .description(
        "Next generation autonomous AI agent for end-to-end testing of web & desktop",
      )
      .version(packageJson.version);

    const commands = this.getCommandDefinitions();

    // Only add CLI-relevant commands (run, edit, sandbox)
    const cliCommands = ["run", "edit", "sandbox"];

    cliCommands.forEach((commandName) => {
      const commandDef = commands[commandName];
      const cmd = program
        .command(commandName)
        .description(commandDef.description);

      // Add arguments
      commandDef.arguments?.forEach((arg) => {
        const argStr = arg.optional ? `[${arg.name}]` : `<${arg.name}>`;
        cmd.argument(argStr, arg.description, arg.default);
      });

      // Add options
      commandDef.options?.forEach((opt) => {
        const optStr =
          opt.type === "string" ? `--${opt.name} <value>` : `--${opt.name}`;
        cmd.option(optStr, opt.description);
      });

      // Set action to use unified command system
      cmd.action(async (...args) => {
        const options = args.pop(); // Last argument is always options
        const argValues = args; // Remaining are argument values

        // Store command for later execution
        this.cliArgs = {
          command: commandName,
          args: argValues,
          options: options,
        };
      });
    });

    // Just parse normally - let commander handle help, version, etc.
    program.parse();

    // If no command was run (no action triggered), default to edit
    if (!this.cliArgs.command) {
      this.cliArgs = {
        command: "edit",
        args: [],
        options: {},
      };
    }

    return this.cliArgs;
  }

  // single function to handle all program exits
  // allows us to save the current state, run lifecycle hooks, and track analytics
  async exit(failed = true, shouldSave = false, shouldRunLifecycle = false) {
    logger.info(theme.dim("exiting..."), true);

    let a = this.parseArgs();

    shouldRunLifecycle = shouldRunLifecycle || a.command == "run";

    if (shouldSave) {
      await this.save();
    }

    analytics.track("exit", { failed });

    if (shouldRunLifecycle) {
      await this.runLifecycle("postrun");
    }

    // we purposly never resolve this promise so the process will hang
    return new Promise(() => {
      this.readlineInterface?.close();
      process.exit(failed ? 1 : 0);
    });
  }

  // fatal errors always exit the program
  // this ensure we log the error, summarize it, and exit cleanly
  async dieOnFatal(error) {
    logger.error(theme.red("Fatal Error") + `\n${error.message}`);
    await this.summarize(error.message);
    return await this.exit(true);
  }

  // creates a new "thread" in which the AI is given an error
  // and responds. notice `actOnMarkdown` which will continue
  // the thread until there are no more codeblocks to execute
  async haveAIResolveError(
    error,
    markdown,
    depth = 0,
    undo = true,
    shouldSave,
  ) {
    // healMode must be required to attempt to recover from errors
    // otherwise we go directly to fatal
    if (!this.healMode) {
      logger.error(
        theme.red("Error detected, but recovery mode is not enabled."),
      );
      logger.info(
        "To attempt automatic recovery, re-run with the --heal flag.",
      );
      return await this.dieOnFatal(error);
    }

    if (error.fatal) {
      return await this.dieOnFatal(error);
    }

    let eMessage = error.message ? error.message : error;

    // we sanitize the error message to use it as a key in the errorCounts object
    let safeKey = JSON.stringify(eMessage);
    this.errorCounts[safeKey] = this.errorCounts[safeKey]
      ? this.errorCounts[safeKey] + 1
      : 1;

    logger.info("");
    logger.error(
      theme.red("Error detected. Attempting to recover (via --heal)..."),
    );

    log.prettyMarkdown(eMessage);

    logger.debug("%j", error);
    logger.debug("%s", error.stack);

    // if we get the same error 3 times in `run` mode, we exit
    if (this.errorCounts[safeKey] > this.errorLimit - 1) {
      logger.info(theme.red("Error loop detected. Exiting."));
      logger.info("%s", eMessage);
      await this.summarize(eMessage);
      return await this.exit(true);
    }

    // remove this step from the execution history
    if (undo) {
      await this.popFromHistory();
    }

    // ask the AI what to do
    let image;
    if (error.attachScreenshot) {
      image = await system.captureScreenBase64();
    } else {
      image = null;
    }

    speak("thinking...");
    notify("thinking...");
    server.broadcast("status", `thinking...`);
    logger.info(theme.dim("thinking..."), true);
    logger.info("");

    const mdStream = log.createMarkdownStreamLogger();

    let response = await sdk.req(
      "error",
      {
        description: eMessage,
        markdown,
        image,
      },
      (chunk) => {
        if (chunk.type === "data") {
          mdStream.log(chunk.data);
        }
      },
    );
    mdStream.end();

    // if the response worked, we try to execute the codeblocks in the response,
    // which begins the recursive process of executing codeblocks
    if (response?.data) {
      return await this.actOnMarkdown(
        response.data,
        depth,
        true,
        false,
        shouldSave,
      );
    }
  }

  // this is run after all possible codeblocks have been executed, but only at depth 0, which is the top level
  // this checks that the task is "really done" using a screenshot of the desktop state
  // it's likely that the task will not be complete and the AI will respond with more codeblocks to execute
  async check() {
    this.checkCount++;

    if (this.checkCount >= this.checkLimit) {
      logger.info(theme.red("Exploratory loop detected. Exiting."));
      await this.summarize("Check loop detected.");
      return await this.exit(true);
    }

    logger.info("");
    logger.info(theme.dim("checking..."), "testdriver");
    server.broadcast("status", `checking...`);
    logger.info("");

    // check asks the ai if the task is complete
    let thisScreenshot = await system.captureScreenBase64(1, false, true);
    let images = [this.lastScreenshot, thisScreenshot];
    let mousePosition = await system.getMousePosition();
    let activeWindow = await system.activeWin();

    const mdStream = log.createMarkdownStreamLogger();
    let response = await sdk.req(
      "check",
      {
        tasks: this.tasks,
        images,
        mousePosition,
        activeWindow,
      },
      (chunk) => {
        if (chunk.type === "data") {
          mdStream.log(chunk.data);
        }
      },
    );
    mdStream.end();

    this.lastScreenshot = thisScreenshot;

    return response.data;
  }

  // command is transformed from a single yml entry generated by the AI into a JSON object
  // it is mapped via `commander` to the `commands` module so the yaml
  // parameters can be mapped to actual functions
  async runCommand(command, depth, shouldSave, pushToHistory) {
    let yml = await yaml.dump(command);

    logger.debug(`running command: \n\n${yml}`);

    try {
      let response;

      // "run" and "if" commands are special meta commands
      // that change the flow of execution
      if (command.command == "run") {
        response = await this.embed(command.file, depth, pushToHistory);
      } else if (command.command == "if") {
        response = await this.iffy(
          command.condition,
          command.then,
          command.else,
          depth,
        );
      } else {
        response = await commander.run(command, depth);
      }

      // if the result of a command contains more commands, we perform the process again
      if (response && typeof response === "string") {
        return await this.actOnMarkdown(response, depth, false, false, false);
      }
    } catch (error) {
      return await this.haveAIResolveError(
        error,
        yaml.dump({ commands: [yml] }),
        depth,
        true,
        shouldSave,
      );
    }
  }

  async executeCommands(
    commands,
    depth,
    pushToHistory = false,
    dry = false,
    shouldSave = false,
  ) {
    if (commands?.length) {
      for (const command of commands) {
        if (pushToHistory) {
          this.executionHistory[
            this.executionHistory.length - 1
          ]?.commands.push(command);
        }

        if (shouldSave) {
          await this.save({ silent: true });
        }

        if (!dry) {
          await this.runCommand(command, depth, shouldSave);
        }
        let timeToComplete = (new Date().getTime() - this.lastCommand) / 1000;
        // logger.info(timeToComplete, 'seconds')

        this.csv.push([command.command, timeToComplete]);
        this.lastCommand = new Date().getTime();
      }
    }
  }

  // codeblocks are ```yml ... ``` blocks found in ai responses
  // this is similar to "function calling" in other ai frameworks
  // here we parse the codeblocks and execute the commands within them
  async executeCodeBlocks(
    codeblocks,
    depth,
    pushToHistory = false,
    dry = false,
    shouldSave = false,
  ) {
    depth = depth + 1;

    logger.debug("%j", { message: "execute code blocks", depth });

    for (const codeblock of codeblocks) {
      let commands;

      try {
        commands = await parser.getCommands(codeblock);
      } catch (e) {
        return await this.haveAIResolveError(
          e,
          yaml.dump(parser.getYAMLFromCodeBlock(codeblock)),
          depth,
          shouldSave,
        );
      }

      await this.executeCommands(
        commands,
        depth,
        pushToHistory,
        dry,
        shouldSave,
      );
    }
  }

  // this is the main function that interacts with the ai, runs commands, and checks the results
  // notice that depth is 0 here. when this function resolves, the task is considered complete
  // notice the call to `check()` which validates the prompt is complete
  async aiExecute(
    message,
    validateAndLoop = false,
    dry = false,
    shouldSave = false,
  ) {
    this.executionHistory.push({ prompt: this.lastPrompt, commands: [] });

    if (shouldSave) {
      await this.save({ silent: true });
    }

    logger.debug("kicking off exploratory loop");

    // kick everything off
    await this.actOnMarkdown(message, 0, true, dry, shouldSave);

    // this calls the "check" function to validate the task is complete"
    // the ai determines if it's complete or not
    // if it is incomplete, the ai will likely return more codeblocks to execute
    if (validateAndLoop) {
      logger.debug("exploratory loop resolved, check your work");

      let response = await this.check();

      let checkCodeblocks = [];
      try {
        checkCodeblocks = await parser.findCodeBlocks(response);
      } catch (error) {
        return await this.haveAIResolveError(error, response, 0, true, true);
      }

      logger.debug(`found ${checkCodeblocks.length} codeblocks`);

      if (checkCodeblocks.length > 0) {
        logger.debug("check thinks more needs to be done");

        logger.info(theme.dim("not done yet!"), "testdriver");
        logger.info("");

        return await this.aiExecute(response, validateAndLoop);
      } else {
        logger.debug("seems complete, returning");

        logger.info(theme.green("success!"), "testdriver");
        logger.info("");

        return response;
      }
    }
  }

  // reads a yaml file and interprets the variables found within it
  async loadYML(file) {
    let yml;

    //wrap this in try/catch so if the file doesn't exist output an error message to the user
    try {
      yml = fs.readFileSync(file, "utf-8");
    } catch (e) {
      logger.error(e);
      logger.error(`File not found: ${file}`);
      logger.error(`Current directory: ${this.workingDir}`);

      await this.summarize("File not found");
      await this.exit(true);
    }
    if (!yml) {
      return {};
    }

    yml = await parser.validateYAML(yml);

    // Inject environment variables into any ${VAR} strings
    yml = parser.interpolate(yml, process.env);

    let ymlObj = null;
    try {
      ymlObj = await yaml.load(yml);
    } catch (e) {
      logger.error("%s", e);
      logger.error(`Invalid YAML: ${file}`);

      await this.summarize("Invalid YAML");
      await this.exit(true);
    }

    return ymlObj;
  }

  // this is a rarely used command that likely doesn't need to exist
  // it's used to call /assert in interactive mode
  // @todo remove assert() command from agent.js
  async assert(expect) {
    analytics.track("assert");

    let task = expect;
    if (!task) {
      // set task to last value of tasks
      let task = this.tasks[this.tasks.length - 1];

      // throw error if no task
      if (!task) {
        throw new Error("No task to assert");
      }
    }

    speak("thinking...");
    notify("thinking...");
    server.broadcast("status", `thinking...`);
    logger.info(theme.dim("thinking..."), true);
    logger.info("");

    let response = `\`\`\`yaml
commands:
  - command: assert
    expect: ${expect}
\`\`\``;

    await this.aiExecute(response);

    await this.save({ silent: true });
  }

  // this function responds to the result of `promptUser()` which is the user input
  // it kicks off the exploratory loop, which is the main function that interacts with the AI
  async exploratoryLoop(
    currentTask,
    dry = false,
    validateAndLoop = false,
    shouldSave = true,
  ) {
    this.lastPrompt = currentTask;
    this.checkCount = 0;

    logger.debug("exploratoryLoop called");

    this.tasks.push(currentTask);

    speak("thinking...");
    notify("thinking...");
    server.broadcast("status", `thinking...`);
    logger.info(theme.dim("thinking..."), true);
    logger.info("");

    this.lastScreenshot = await system.captureScreenBase64();

    const mdStream = log.createMarkdownStreamLogger();
    let message = await sdk.req(
      "input",
      {
        input: currentTask,
        mousePosition: await system.getMousePosition(),
        activeWindow: await system.activeWin(),
        image: this.lastScreenshot,
      },
      (chunk) => {
        if (chunk.type === "data") {
          mdStream.log(chunk.data);
        }
      },
    );
    mdStream.end();

    if (message) {
      await this.aiExecute(message.data, validateAndLoop, dry, shouldSave);
      logger.debug("showing prompt from exploratoryLoop response check");
    }

    return;
  }

  // generate asks the AI to come up with ideas for test files
  // based on the current state of the system (primarily the current screenshot)
  // it will generate files that contain only "prompts"
  // @todo revit the generate command
  async generate(type, count, baseYaml, skipYaml = false) {
    logger.debug("generate called, %s", type);

    speak("thinking...");
    notify("thinking...");
    server.broadcast("status", `thinking...`);
    logger.info(theme.dim("thinking..."), true);
    logger.info("");

    if (baseYaml && !skipYaml) {
      await this.runLifecycle("prerun");
      await this.run(baseYaml, false, false, false);
    }

    let image = await system.captureScreenBase64();
    const mdStream = log.createMarkdownStreamLogger();
    let message = await sdk.req(
      "generate",
      {
        type,
        image,
        mousePosition: await system.getMousePosition(),
        activeWindow: await system.activeWin(),
        count,
      },
      (chunk) => {
        if (chunk.type === "data") {
          mdStream.log(chunk.data);
        }
      },
    );
    mdStream.end();

    let testPrompts = await parser.findGenerativePrompts(message.data);

    // for each testPrompt
    for (const testPrompt of testPrompts) {
      // with the contents of the testPrompt
      let fileName =
        sanitizeFilename(testPrompt.name)
          .trim()
          .replace(/ /g, "-")
          .replace(/['"`]/g, "")
          .replace(/[^a-zA-Z0-9-]/g, "") // remove any non-alphanumeric chars except hyphens
          .toLowerCase() + ".yaml";
      let path1 = path.join(
        this.workingDir,
        "testdriver",
        "generate",
        fileName,
      );

      // create generate directory if it doesn't exist
      if (
        !fs.existsSync(path.join(this.workingDir, "testdriver", "generate"))
      ) {
        fs.mkdirSync(path.join(this.workingDir, "testdriver", "generate"));
      }

      let list = testPrompt.steps;

      if (baseYaml && fs.existsSync(baseYaml)) {
        list.unshift({
          step: {
            command: "run",
            file: baseYaml,
          },
        });
      }
      let contents = yaml.dump({
        version: packageJson.version,
        steps: list,
      });
      fs.writeFileSync(path1, contents);
    }

    this.exit(false);
  }

  // this is the functinoality for "undo"
  async popFromHistory(fullStep) {
    logger.info(theme.dim("undoing..."), true);

    if (this.executionHistory.length) {
      if (fullStep) {
        this.executionHistory.pop();
      } else {
        this.executionHistory[this.executionHistory.length - 1].commands.pop();
      }
      if (
        !this.executionHistory[this.executionHistory.length - 1].commands.length
      ) {
        this.executionHistory.pop();
      }
    }
  }

  async undo() {
    analytics.track("undo");

    this.popFromHistory();
    await this.save();
  }

  // this allows the user to input "flattened yaml"
  // like "command='focus-application' name='Google Chrome'"
  async manualInput(commandString) {
    analytics.track("manual input");

    let yml = await generator.manualToYml(commandString);

    let message = `\`\`\`yaml
${yml}
\`\`\``;

    await this.aiExecute(message, false);

    await this.save({ silent: true });
  }

  // this function is responsible for starting the recursive process of executing codeblocks
  async actOnMarkdown(
    content,
    depth,
    pushToHistory = false,
    dry = false,
    shouldSave = false,
  ) {
    logger.debug("%j", {
      message: "actOnMarkdown called",
      depth,
    });

    let codeblocks = [];
    try {
      codeblocks = await parser.findCodeBlocks(content);
    } catch (error) {
      pushToHistory = false;
      return await this.haveAIResolveError(
        error,
        content,
        depth,
        false,
        shouldSave,
      );
    }

    if (codeblocks.length) {
      let executions = await this.executeCodeBlocks(
        codeblocks,
        depth,
        pushToHistory,
        dry,
        shouldSave,
      );
      return executions;
    } else {
      return true;
    }
  }

  // simple function to start the interactive readline interface
  async startInteractiveMode() {
    this.readlineInterface = new ReadlineInterface(this);
    await this.readlineInterface.start();
  }

  // this function is responsible for summarizing the test script that has already executed
  // it is what is saved to the `/tmp/testdriver-summary.md` file and output to the action as a summary
  async summarize(error = null) {
    analytics.track("summarize");

    logger.info("");

    logger.info(theme.dim("reviewing test..."), true);

    // let text = prompts.summarize(tasks, error);
    let image = await system.captureScreenBase64();

    logger.info(theme.dim("summarizing..."), true);

    const mdStream = log.createMarkdownStreamLogger();
    let reply = await sdk.req(
      "summarize",
      {
        image,
        error: error?.toString(),
        tasks: this.tasks,
      },
      (chunk) => {
        if (chunk.type === "data") {
          mdStream.log(chunk.data);
        }
      },
    );
    mdStream.end();

    // Only write summary to file if --summary option was provided
    if (this.resultFile) {
      // Ensure the output directory exists
      const outputDir = path.dirname(this.resultFile);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(this.resultFile, reply.data);
      logger.info(theme.dim(`Summary written to: ${this.resultFile}`));
    } else {
      const tmpFile = path.join(os.tmpdir(), "testdriver-summary.md");
      fs.writeFileSync(tmpFile, reply.data);
      logger.info(theme.dim(`Summary written to: ${tmpFile}`));
    }
  }

  // this function is responsible for saving the regression test script to a file
  async save({ filepath = this.thisFile, silent = false } = {}) {
    analytics.track("save", { silent });

    if (!this.executionHistory.length) {
      return;
    }

    // write reply to /tmp/testdriver-summary.md
    let regression = await generator.dumpToYML(this.executionHistory);
    try {
      fs.writeFileSync(filepath, regression);
    } catch (e) {
      console.log(e);
      logger.error(e.message);
      logger.error("%s", e);
    }

    if (!silent) {
      log.prettyMarkdown(`Current test script:

\`\`\`yaml
${regression}
\`\`\``);

      if (!silent) {
        logger.info(theme.dim(`saved as ${filepath}`));
      }
    }

    return;
  }

  async runRawYML(yml) {
    const tmp = require("tmp");
    let tmpobj = tmp.fileSync();

    let decoded = decodeURIComponent(yml);

    // parse the yaml
    let ymlObj = null;
    try {
      ymlObj = await yaml.load(decoded);
    } catch (e) {
      logger.error("%s", e);
    }

    // add the root key steps: with array of commands:
    if (ymlObj && !ymlObj.steps) {
      ymlObj = {
        version: packageJson.version,
        steps: [ymlObj],
      };
    }

    // write the yaml to a file
    fs.writeFileSync(tmpobj.name, yaml.dump(ymlObj));

    // and run it with run()

    await this.runLifecycle("prerun");
    await this.run(tmpobj.name, false, false);
  }

  // this will load a regression test from a file location
  // it parses the markdown file and executes the codeblocks exactly as if they were
  // generated by the AI in a single prompt
  async run(
    file = this.thisFile,
    shouldSave = false,
    shouldExit = true,
    pushToHistory = true,
  ) {
    console.log({ file, shouldSave, shouldExit, pushToHistory });

    this.emit(events.interactive, false);

    logger.info(theme.cyan(`running ${file}...`));

    let ymlObj = await this.loadYML(file);

    if (ymlObj.version) {
      let valid = isValidVersion(ymlObj.version);
      if (!valid) {
        console.log("");
        logger.warn(theme.yellow(`Version mismatch detected!`));
        logger.warn(
          theme.yellow(`Running a test created with v${ymlObj.version}.`),
        );
        logger.warn(
          theme.yellow(
            `The local testdriverai version is v${packageJson.version}.`,
          ),
        );
      }
    }

    this.executionHistory = [];

    if (!ymlObj.steps || !ymlObj.steps.length) {
      logger.info(theme.red("No steps found in the YAML file"));
      await this.exit(true, shouldSave, true);
    }

    for (const step of ymlObj.steps) {
      logger.info(``, null);
      logger.info(theme.yellow(`> ${step.prompt || "no prompt"}`), null);

      if (!step.commands && !step.prompt) {
        logger.info(theme.red("No commands or prompt found"));
        await this.exit(true, shouldSave, true);
      } else if (!step.commands) {
        logger.info(theme.yellow("No commands found, running exploratory"));
        await this.exploratoryLoop(step.prompt, false, true, shouldSave);
      } else {
        let markdown = `\`\`\`yaml
${yaml.dump(step)}
  \`\`\``;

        logger.debug(markdown);
        logger.debug("load calling actOnMarkdown");

        this.lastPrompt = step.prompt;
        await this.actOnMarkdown(markdown, 0, true, false, shouldSave);
      }

      if (shouldSave) {
        await this.save({ silent: true });
      }
    }

    if (shouldSave) {
      await this.save({ filepath: file, silent: false });
    }

    if (shouldExit) {
      await this.summarize();
      await this.exit(false, shouldSave, true);
    }
  }

  async iffy(condition, then, otherwise, depth) {
    analytics.track("if", { condition });

    logger.info(generator.jsonToManual({ command: "if", condition }));

    let response = await commands.assert(condition, false);

    depth = depth + 1;

    if (response) {
      return await this.executeCommands(then, depth);
    } else {
      return await this.executeCommands(otherwise, depth);
    }
  }

  async embed(file, depth, pushToHistory) {
    analytics.track("embed", { file });

    logger.info(generator.jsonToManual({ command: "run", file }));

    depth = depth + 1;

    logger.info(`${file} (start)`);

    // get the current wowrking directory where this file is being executed
    let cwd = this.workingDir;

    // if the file is not an absolute path, we will try to resolve it
    if (!path.isAbsolute(file)) {
      file = path.resolve(cwd, file);
    }

    // check if the file exists
    if (!fs.existsSync(file)) {
      throw `Embedded file not found: ${file}`;
    }

    let ymlObj = await this.loadYML(file);

    for (const step of ymlObj.steps) {
      if (!step.commands && !step.prompt) {
        logger.info(theme.red("No commands or prompt found"));
        await this.exit(true);
      } else if (!step.commands) {
        logger.info(theme.yellow("No commands found, running exploratory"));
        await this.exploratoryLoop(step.prompt, false, true, false);
      } else {
        await this.executeCommands(step.commands, depth, pushToHistory);
      }
    }

    logger.info(`${file} (end)`);
  }

  async handleSandboxCommand(cliArgs) {
    if (cliArgs.list) {
      await this.listSandboxes();
    } else if (cliArgs.destroy) {
      await this.destroySandbox(cliArgs.destroy);
    } else if (cliArgs.create) {
      await this.createSandbox();
    } else {
      logger.error(
        "Please specify a sandbox action: --list, --destroy <id>, or --create",
      );
      process.exit(1);
    }
  }

  async listSandboxes() {
    await this.connectToSandboxService();

    logger.info("");
    logger.info("Listing sandboxes...");

    let reply = await sandbox.send({
      type: "list",
    });

    console.table(reply.sandboxes);
  }

  async destroySandbox(sandboxId) {
    await this.connectToSandboxService();

    let reply = await sandbox.send({
      type: "destroy",
      id: sandboxId,
    });

    console.table(reply.sandboxes);
  }

  async createSandbox() {
    await this.connectToSandboxService();

    logger.info("");
    logger.info("Creating new sandbox...");

    let instance = await this.createNewSandbox();

    console.table([instance.sandbox]);
  }

  // Returns sandboxId to use (either from file if recent, or null)
  getRecentSandboxId() {
    const lastSandboxFile = path.join(
      os.homedir(),
      ".testdriverai-last-sandbox",
    );
    if (fs.existsSync(lastSandboxFile)) {
      try {
        const stats = fs.statSync(lastSandboxFile);
        const mtime = new Date(stats.mtime);
        const now = new Date();
        const diffMinutes = (now - mtime) / (1000 * 60);
        if (diffMinutes < 30) {
          const lastSandboxId = fs
            .readFileSync(lastSandboxFile, "utf-8")
            .trim();
          if (lastSandboxId) {
            return lastSandboxId;
          }
        }
      } catch {
        // ignore errors
      }
    }
    return null;
  }

  saveLastSandboxId(instanceId) {
    const lastSandboxFile = path.join(
      os.homedir(),
      ".testdriverai-last-sandbox",
    );
    try {
      fs.writeFileSync(lastSandboxFile, instanceId, { encoding: "utf-8" });
    } catch {
      // ignore errors
    }
  }

  async buildEnv(headless = false) {
    // order is important!
    await this.connectToSandboxService();

    if (!this.sandboxId && !this.newSandbox) {
      const recentId = this.getRecentSandboxId();
      if (recentId) {
        logger.info(theme.dim(`- using recent sandbox: ${recentId}`));
        this.sandboxId = recentId;
      } else {
        logger.info(theme.dim(`- creating new sandbox...`));
        logger.info(theme.dim(`  (this can take between 10 - 240 seconds)`));
      }
    } else {
      if (this.newSandbox) {
        logger.info(theme.dim(`- creating new sandbox (--new-sandbox)...`));
      } else {
        // I think this is a bad state
        logger.info(
          theme.dim(`- creating new sandbox (no recent sandbox created)...`),
        );
      }
    }

    if (this.sandboxId) {
      let instance = await this.connectToSandboxDirect(this.sandboxId);
      await this.renderSandbox(instance, headless);
      await this.newSession();
    } else {
      let newSandbox = await this.createNewSandbox();
      this.saveLastSandboxId(newSandbox.sandbox.instanceId);
      let instance = await this.connectToSandboxDirect(
        newSandbox.sandbox.instanceId,
      );
      await this.renderSandbox(instance, headless);
      await this.newSession();
      await this.runLifecycle("provision");
    }
  }

  async start() {
    let a = this.parseArgs();

    const thisCommand = a.command || "edit";

    // Extract file from args or use default
    const normalizeFilePath = (file) => {
      if (!file) {
        file = "testdriver/testdriver.yaml";
      }
      file = path.join(this.workingDir, file);
      if (!file.endsWith(".yaml") && !file.endsWith(".yml")) {
        file += ".yaml";
      }
      return file;
    };

    this.thisFile = normalizeFilePath(a.args?.[0]);

    // Set output file for summarize results if specified
    if (a.options?.summary && typeof a.options.summary === "string") {
      this.resultFile = path.resolve(a.options.summary);
    }

    logger.info(theme.green(`Howdy! I'm TestDriver v${packageJson.version}`));
    logger.info(`This is beta software!`);
    logger.info("");
    logger.info(theme.yellow(`Join our Forums for help`));
    logger.info(`https://forums.testdriver.ai`);
    logger.info("");

    // make testdriver directory if it doesn't exist
    let testdriverFolder = path.join(this.workingDir, "testdriver");
    if (!fs.existsSync(testdriverFolder)) {
      fs.mkdirSync(testdriverFolder);
      // log
      logger.info(theme.dim(`Created testdriver directory`));
      console.log(
        theme.dim(`Created testdriver directory: ${testdriverFolder}`),
      );
    }

    // if the directory for thisFile doesn't exist, create it
    if (thisCommand !== "sandbox") {
      const dir = path.dirname(this.thisFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(theme.dim(`Created directory ${dir}`));
      }

      // if thisFile doesn't exist, create it
      // thisFile def to testdriver/testdriver.yaml, during init, it just creates an empty file
      if (!fs.existsSync(this.thisFile)) {
        fs.writeFileSync(this.thisFile, "");
        logger.info(theme.dim(`Created ${this.thisFile}`));
      }
    }

    if (config.TD_API_KEY) {
      await sdk.auth();
    }

    // Start the debugger server
    await createDebuggerProcess();

    if (thisCommand !== "run") {
      speak("Howdy! I am TestDriver version " + packageJson.version);
    }

    if (thisCommand !== "sandbox") {
      logger.info(theme.dim(`Working on ${this.thisFile}`));
      console.log("");

      this.loadYML(this.thisFile);
    }

    analytics.track("command", { command: thisCommand, file: this.thisFile });

    // Handle different commands
    if (thisCommand === "edit") {
      await this.buildEnv();
      await this.startInteractiveMode();
    } else if (thisCommand === "run") {
      await this.buildEnv(a.options?.headless);
      this.errorLimit = 100;
      await this.executeUnifiedCommand(thisCommand, a.args, a.options);
    } else if (thisCommand === "sandbox") {
      await this.executeUnifiedCommand(thisCommand, a.args, a.options);
    }
  }

  async renderSandbox(instance, headless = false) {
    this.emit(events.interactive, false);

    if (!headless) {
      this.emit(events.showWindow, {
        url: instance.vncUrl + "/vnc_lite.html",
        resolution: config.TD_RESOLUTION,
      });
    }
  }

  async connectToSandboxService() {
    logger.info(theme.gray(`- establishing connection...`));
    server.broadcast("status", `Establishing connection...`);
    await sandbox.boot(config.TD_API_ROOT);
    logger.info(theme.gray(`- authenticating...`));
    server.broadcast("status", `Authenticating...`);
    await sandbox.auth(config.TD_API_KEY);
  }

  async connectToSandboxDirect(sandboxId) {
    logger.info(theme.gray(`- connecting...`));
    server.broadcast("status", `Connecting...`);
    let instance = await sandbox.connect(sandboxId);
    return instance;
  }

  async createNewSandbox() {
    server.broadcast("status", `Creating new sandbox...`);
    let instance = await sandbox.send({
      type: "create",
      resolution: config.TD_RESOLUTION,
    });
    return instance;
  }

  async newSession() {
    // should be start of new session
    const sessionRes = await sdk.req("session/start", {
      systemInformationOsInfo: await system.getSystemInformationOsInfo(),
      mousePosition: await system.getMousePosition(),
      activeWindow: await system.activeWin(),
    });

    if (!sessionRes) {
      throw new Error(
        "Unable to start TestDriver session.  Check your network connection or restart the CLI.",
      );
    }

    session.set(sessionRes.data.id);
  }

  async runLifecycle(lifecycleName) {
    const lifecycleFile = path.join(
      this.workingDir,
      "testdriver",
      "lifecycle",
      `${lifecycleName}.yaml`,
    );
    if (fs.existsSync(lifecycleFile)) {
      await this.run(lifecycleFile, false, false, false);
    }
  }

  // Unified command definitions that work for both CLI and interactive modes
  getCommandDefinitions() {
    return createCommandDefinitions(this);
  }

  // Execute a unified command
  async executeUnifiedCommand(commandName, args = {}, options = {}) {
    const commands = this.getCommandDefinitions();
    const command = commands[commandName];

    if (!command) {
      throw new Error(`Unknown command: ${commandName}`);
    }

    // Convert args array to object if needed
    const argsObj = {};
    if (Array.isArray(args)) {
      command.arguments?.forEach((argDef, index) => {
        if (argDef.variadic) {
          argsObj[argDef.name] = args.slice(index);
        } else {
          argsObj[argDef.name] = args[index] || argDef.default;
        }
      });
    } else {
      Object.assign(argsObj, args);
    }

    await command.handler(argsObj, options);
  }
}

module.exports = TestDriverAgent;
