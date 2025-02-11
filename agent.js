#!/usr/bin/env node

const os = require("os");

// Get the current process ID
const pid = process.pid;

try {
  // Set the priority to the highest value
  os.setPriority(pid, -20);
  // eslint-disable-next-line no-unused-vars
} catch (error) {
  // console.error('Failed to set process priority:', error);
}

// disable depreciation warnings
process.removeAllListeners("warning");

// package.json is included to get the version number
const package = require("./package.json");

const fs = require("fs");
const readline = require("readline");
const http = require("http");

// third party modules
const path = require("path");
const chalk = require("chalk");
const yaml = require("js-yaml");
const sanitizeFilename = require("sanitize-filename");
const macScreenPerms = require("mac-screen-capture-permissions");

// local modules
const speak = require("./lib/speak.js");
const analytics = require("./lib/analytics.js");
const log = require("./lib/logger.js");
const parser = require("./lib/parser.js");
const commander = require("./lib/commander.js");
const system = require("./lib/system.js");
const generator = require("./lib/generator.js");
const sdk = require("./lib/sdk.js");
const commands = require("./lib/commands.js");
const init = require("./lib/init.js");
const config = require("./lib/config.js");

const { showTerminal, hideTerminal } = require("./lib/focus-application.js");
const isValidVersion = require("./lib/valid-version.js");
const session = require("./lib/session.js");
const notify = require("./lib/notify.js");
const { emitter, events } = require("./lib/events.js");

const logger = log.logger;

let gLastPrompt = "";
let gTerminalApp = "";
let gCommandHistory = [];
let gExecutionHistory = [];
let gErrorCounts = {};
let gErrorLimit = 3;
let gCheckCount = 0;
let gCheckLimit = 7;
let gLastScreenshot = null;
let gReadline;
let gExitOnError = false;
let gCurrentFile;

// list of prompts that the user has given us
let gTasks = [];

let gIsInteractive = false;
emitter.on(events.interactive, (data) => {
  gIsInteractive = data;
});

const COMMAND_HISTORY_FILE = path.join(os.homedir(), ".testdriver_history");

function fileCompleter(line) {
  line = line.slice(5); // remove /run
  const lastSepIndex = line.lastIndexOf(path.sep);
  let dir;
  let partial;
  if (lastSepIndex === -1) {
    dir = ".";
    partial = line;
  } else {
    dir = line.slice(0, lastSepIndex + 1);
    partial = line.slice(lastSepIndex + 1);
  }
  try {
    const dirPath = path.resolve(process.cwd(), dir);

    let files = fs.readdirSync(dirPath);
    files = files.map((file) => {
      const fullFilePath = path.join(dirPath, file);
      const fileStats = fs.statSync(fullFilePath);
      return file + (fileStats.isDirectory() ? path.sep : ""); // add path.sep for dir
    });
    const matches = files.filter((file) => file.startsWith(partial));

    return [matches.length ? matches : files, partial];
  } catch (e) {
    logger.info("%s", e);
    return [[], partial];
  }
}

function completer(line) {
  let completions = "/summarize /save /run /quit /assert /undo /manual".split(
    " ",
  );
  if (line.startsWith("/run ")) {
    return fileCompleter(line);
  } else {
    completions.concat(gTasks);

    var hits = completions.filter(function (c) {
      return c.indexOf(line) == 0;
    });
    // show all completions if none found
    return [hits.length ? hits : completions, line];
  }
}

const exit = async (failed = true, shouldSave = false) => {

  if (shouldSave) {
    await save();
  }

  analytics.track("exit", { failed });

  // we purposly never resolve this promise so the process will hang
  return new Promise(() => {
    gReadline?.close();
    gReadline?.removeAllListeners();
    process.exit(failed ? 1 : 0);
  });
};

const dieOnFatal = async (error) => {
  logger.error(chalk.red("Fatal Error") + `\n${error.message}`);
  await summarize(error.message);
  return await exit(true);
};

// creates a new "thread" in which the AI is given an error
// and responds. notice `actOnMarkdown` which will continue
// the thread until there are no more codeblocks to execute
const haveAIResolveError = async (error, markdown, depth = 0, undo = true) => {
  if (gExitOnError || error.fatal) {
    return await dieOnFatal(error);
  }

  let eMessage = error.message ? error.message : error;

  let safeKey = JSON.stringify(eMessage);
  gErrorCounts[safeKey] = gErrorCounts[safeKey] ? gErrorCounts[safeKey] + 1 : 1;

  logger.error(eMessage);

  logger.debug("%j",  error);
  logger.debug("%s", error.stack);

  log.prettyMarkdown(eMessage);

  // if we get the same error 3 times in `run` mode, we exit
  if (gErrorCounts[safeKey] > gErrorLimit - 1) {
    logger.info(chalk.red("Error loop detected. Exiting."));
    logger.info("%s", eMessage);
    await summarize(eMessage);
    return await exit(true);
  }

  if (undo) {
    await popFromHistory();
  }

  let image;
  if (error.attachScreenshot) {
    image = await system.captureScreenBase64();
  } else {
    image = null;
  }

  speak("thinking...");
  notify("thinking...");
  logger.info(chalk.dim("thinking..."), true);
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

  if (response?.data) {
    return await actOnMarkdown(response.data, depth, true);
  }
};

// this is run after all possible codeblocks have been executed, but only at depth 0, which is the top level
// this checks that the task is "really done" using a screenshot of the desktop state
// it's likely that the task will not be complete and the AI will respond with more codeblocks to execute
const check = async () => {
  gCheckCount++;

  if (gCheckCount >= gCheckLimit) {
    logger.info(chalk.red("Exploratory loop detected. Exiting."));
    await summarize("Check loop detected.");
    return await exit(true);
  }

  logger.info("");
  logger.info(chalk.dim("checking..."), "testdriver");
  logger.info("");

  let thisScreenshot = await system.captureScreenBase64(1, false, true);
  let images = [gLastScreenshot, thisScreenshot];
  let mousePosition = await system.getMousePosition();
  let activeWindow = await system.activeWin();

  const mdStream = log.createMarkdownStreamLogger();
  let response = await sdk.req(
    "check",
    {
      tasks: gTasks,
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

  gLastScreenshot = thisScreenshot;

  return response.data;
};

// command is transformed from a single yml entry generated by the AI into a JSON object
// it is mapped via `commander` to the `commands` module so the yaml
// parameters can be mapped to actual functions
const runCommand = async (command, depth) => {
  let yml = await yaml.dump(command);

  logger.debug(`running command: \n\n${yml}`);

  try {
    let response;

    if (command.command == "run") {
      response = await embed(command.file, depth);
    } else if (command.command == "if") {
      response = await iffy(
        command.condition,
        command.then,
        command.else,
        depth,
      );
    } else {
      response = await commander.run(command, depth);
    }

    if (response && typeof response === "string") {
      return await actOnMarkdown(response, depth);
    }
  } catch (error) {
    return await haveAIResolveError(
      error,
      yaml.dump({ commands: [yml] }),
      depth,
      true,
    );
  }
};

let gLastCommand = new Date().getTime();
let gCsv = [["command,time"]];

const executeCommands = async (commands, depth, pushToHistory = false) => {
  if (commands?.length) {

    for (const command of commands) {
      if (pushToHistory) {
        gExecutionHistory[gExecutionHistory.length - 1]?.commands.push(command);
      }

      await runCommand(command, depth);

      let timeToComplete = (new Date().getTime() - gLastCommand) / 1000;
      // logger.info(timeToComplete, 'seconds')

      gCsv.push([command.command, timeToComplete]);
      gLastCommand = new Date().getTime();
    }
  }
};

// note that commands are run in a recursive loop, so that the AI can respond to the output of the commands
// like `click-image` and `click-text` for example
const executeCodeBlocks = async (codeblocks, depth, pushToHistory = false) => {
  depth = depth + 1;

  logger.debug("%j", { message: "execute code blocks", depth });

  for (const codeblock of codeblocks) {
    let commands;

    try {
      commands = await parser.getCommands(codeblock);
    } catch (e) {
      return await haveAIResolveError(
        e,
        yaml.dump(parser.getYAMLFromCodeBlock(codeblock)),
        depth,
      );
    }

    await executeCommands(commands, depth, pushToHistory);
  }
};

// this is the main function that interacts with the ai, runs commands, and checks the results
// notice that depth is 0 here. when this function resolves, the task is considered complete
// notice the call to `check()` which validates the prompt is complete
const aiExecute = async (message, validateAndLoop = false) => {
  gExecutionHistory.push({ prompt: gLastPrompt, commands: [] });

  logger.debug("kicking off exploratory loop");

  // kick everything off
  await actOnMarkdown(message, 0, true);

  if (validateAndLoop) {
    logger.debug("exploratory loop resolved, check your work");

    let response = await check();

    let checkCodeblocks = [];
    try {
      checkCodeblocks = await parser.findCodeBlocks(response);
    } catch (error) {
      return await haveAIResolveError(error, response, 0);
    }

    logger.debug(`found ${checkCodeblocks.length} codeblocks`);

    if (checkCodeblocks.length > 0) {
      logger.debug("check thinks more needs to be done");
      return await aiExecute(response, validateAndLoop);
    } else {
      logger.debug("seems complete, returning");
      return response;
    }
  }
};

const loadYML = async (file) => {

  let yml;

  //wrap this in try/catch so if the file doesn't exist output an error message to the user
  try {
    yml = fs.readFileSync(file, "utf-8");
  } catch (e) {
    logger.error(e);
    logger.error(`File not found: ${file}`);
    logger.error(`Current directory: ${process.cwd()}`);

    await summarize("File not found");
    await exit(true);
  }

  let interpolationVars = JSON.parse(process.env["TD_INTERPOLATION_VARS"] || '{}');

  // Inject environment variables into any ${VAR} strings
  yml = parser.interpolate(yml, process.env);

  // Inject any vars from the TD_INTERPOLATION_VARS variable (typically from the action)
  yml = parser.interpolate(yml, interpolationVars);


  let ymlObj = null;
  try {
    ymlObj = await yaml.load(yml);
  } catch (e) {
    logger.error("%s", e);
    logger.error(`Invalid YAML: ${file}`);

    await summarize("Invalid YAML");
    await exit(true);
  }

  return ymlObj;

}

const assert = async (expect) => {
  analytics.track("assert");

  let task = expect;
  if (!task) {
    // set task to last value of gTasks
    let task = gTasks[gTasks.length - 1];

    // throw error if no task
    if (!task) {
      throw new Error("No task to assert");
    }
  }

  speak("thinking...");
  notify("thinking...");
  logger.info(chalk.dim("thinking..."), true);
  logger.info("");

  let response = `\`\`\`yml
commands:
  - command: assert
    expect: ${expect}
\`\`\``;

  await aiExecute(response);

  await save({ silent: true });
};

// this function responds to the result of `promptUser()` which is the user input
// it kicks off the exploratory loop, which is the main function that interacts with the AI
const humanInput = async (currentTask, validateAndLoop = false) => {
  gLastPrompt = currentTask;
  gCheckCount = 0;

  logger.debug("humanInput called");

  gTasks.push(currentTask);

  speak("thinking...");
  notify("thinking...");
  logger.info(chalk.dim("thinking..."), true);
  logger.info("");

  gLastScreenshot = await system.captureScreenBase64();

  const mdStream = log.createMarkdownStreamLogger();
  let message = await sdk.req(
    "input",
    {
      input: currentTask,
      mousePosition: await system.getMousePosition(),
      activeWindow: await system.activeWin(),
      image: gLastScreenshot,
    },
    (chunk) => {
      if (chunk.type === "data") {
        mdStream.log(chunk.data);
      }
    },
  );
  mdStream.end();

  await aiExecute(message.data, validateAndLoop);

  logger.debug("showing prompt from humanInput response check");

  await save({ silent: true });
};

const generate = async (type, count) => {
  logger.debug("generate called, %s", type);

  speak("thinking...");
  notify("thinking...");

  logger.info(chalk.dim("thinking..."), true);
  logger.info("");

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
      sanitizeFilename(testPrompt.headings[0])
        .trim()
        .replace(/ /g, "-")
        .replace(/['"`]/g, "")
        .replace(/[^a-zA-Z0-9-]/g, "") // remove any non-alphanumeric chars except hyphens
        .toLowerCase() + ".md";
    let path1 = path.join(process.cwd(), "testdriver", "generate", fileName);

    // create generate directory if it doesn't exist
    if (!fs.existsSync(path.join(process.cwd(), "testdriver", "generate"))) {
      fs.mkdirSync(path.join(process.cwd(), "testdriver", "generate"));
    }

    let list = testPrompt.listsOrdered[0];

    let contents = list
      .map((item, index) => `${index + 1}. ${item}`)
      .join("\n");
    fs.writeFileSync(path1, contents);
  }

  exit(false);
};

const popFromHistory = async (fullStep) => {
  logger.info(chalk.dim("undoing..."), true);

  if (gExecutionHistory.length) {
    if (fullStep) {
      gExecutionHistory.pop();
    } else {
      gExecutionHistory[gExecutionHistory.length - 1].commands.pop();
    }
    if (!gExecutionHistory[gExecutionHistory.length - 1].commands.length) {
      gExecutionHistory.pop();
    }
  }
};

const undo = async () => {
  analytics.track("undo");

  popFromHistory();
  await save();
};

const manualInput = async (commandString) => {
  analytics.track("manual input");

  let yml = await generator.manualToYml(commandString);

  let message = `\`\`\`yaml
${yml}
\`\`\``;

  await aiExecute(message, false);

  await save({ silent: true });
};

// this function is responsible for starting the recursive process of executing codeblocks
const actOnMarkdown = async (content, depth, pushToHistory = false) => {
  logger.debug("%j", {
    message: "actOnMarkdown called",
    depth,
  });

  let codeblocks = [];
  try {
    codeblocks = await parser.findCodeBlocks(content);
  } catch (error) {
    pushToHistory = false;
    return await haveAIResolveError(error, content, depth);
  }

  if (codeblocks.length) {
    let executions = await executeCodeBlocks(codeblocks, depth, pushToHistory);
    return executions;
  } else {
    return true;
  }
};

const newSession = async () => {

  // should be start of new session
  const sessionRes = await sdk.req("session/start", {
    systemInformationOsInfo: await system.getSystemInformationOsInfo(),
    mousePosition: await system.getMousePosition(),
    activeWindow: await system.activeWin(),
  });

  session.set(sessionRes.data.id);

};

// simple function to backfill the chat history with a prompt and
// then call `promptUser()` to get the user input
const firstPrompt = async () => {

  await newSession();

  // readline is what allows us to get user input
  gReadline = readline.createInterface({
    terminal: true,
    history: gCommandHistory,
    removeHistoryDuplicates: true,
    input: process.stdin,
    output: process.stdout,
    completer,
  });

  analytics.track("first prompt");

  gReadline.on("SIGINT", async () => {
    analytics.track("sigint");
    await exit(false);
  });

  // this is how we parse user input
  // notice that the AI is only called if the input is not a command
  gReadline.on("line", async (input) => {
    if (!gIsInteractive) return;
    if (!input.trim().length) return promptUser();

    emitter.emit(events.interactive, false);
    setTerminalWindowTransparency(true);
    gErrorCounts = {};

    // append this to COMMAND_HISTORY_FILE
    fs.appendFileSync(COMMAND_HISTORY_FILE, input + "\n");

    analytics.track("input", { input });

    logger.info(""); // adds a nice break between submissions

    let commands = input.split(" ");

    // if last character is a question mark, we assume the user is asking a question
    if (input.indexOf("/summarize") == 0) {
      await summarize();
    } else if (input.indexOf("/quit") == 0) {
      await exit(false, true);
    } else if (input.indexOf("/save") == 0) {
      await save({ filepath: commands[1] });
    } else if (input.indexOf("/undo") == 0) {
      await undo();
    } else if (input.indexOf("/assert") == 0) {
      await assert(commands.slice(1).join(" "));
    } else if (input.indexOf("/manual") == 0) {
      await manualInput(commands.slice(1).join(" "));
    } else if (input.indexOf("/run") == 0) {
      await run(commands[1], commands[2] == "true", commands[3] == "true");
    } else if (input.indexOf("/generate") == 0) {
      await generate(commands[1], commands[2]);
    } else {
      await humanInput(input, true);
    }

    setTerminalWindowTransparency(false);
    promptUser();
  });

  // if file exists, load it
  if (fs.existsSync(gCurrentFile)) {
    analytics.track("load");

    // this will overwrite the session if we find one in the YML
    let object = await generator.hydrateFromYML(
      fs.readFileSync(gCurrentFile, "utf-8"),
    );

    if (!object?.steps) {
      analytics.track("load invalid yaml");
      logger.error("Invalid YAML. No steps found.");
      logger.info("Invalid YAML: " + gCurrentFile);
      return await exit(true);
    }

    // push each step to gExecutionHistory from { commands: {steps: [ { commands: [Array] } ] } }
    object.steps.forEach((step) => {
      gExecutionHistory.push(step);
    });

    let yml = fs.readFileSync(gCurrentFile, "utf-8");

    let markdown = `\`\`\`yaml
${yml}
\`\`\``;

    logger.info(`Loaded test script ${gCurrentFile}\n`);

    log.prettyMarkdown(`

${markdown}

New commands will be appended.
`);
  }

  promptUser();
};

let setTerminalWindowTransparency = async (hide) => {
  if (hide) {
    try {
      http
        .get("http://localhost:60305/hide")
        .on("error", function () {})
        .end();
    } catch (e) {
      // Suppress error
      logger.error("Caught exception: %s", e);
    }
  } else {
    try {
      http
        .get("http://localhost:60305/hide")
        .on("error", function () {})
        .end();
    } catch (e) {
      // Suppress error
      logger.error("Caught exception:", e);
    }
  }

  if (!config.TD_MINIMIZE) {
    return;
  }

  try {
    if (hide) {
      if (gTerminalApp) {
        hideTerminal(gTerminalApp);
      }
    } else {
      if (gTerminalApp) {
        showTerminal(gTerminalApp);
      }
    }
  } catch (e) {
    // Suppress error
    logger.error("Caught exception: %s", e);
  }
};

// this function is responsible for summarizing the test script that has already executed
// it is what is saved to the `/tmp/oiResult.log` file and output to the action as a summary
let summarize = async (error = null) => {
  analytics.track("summarize");

  logger.info("");

  logger.info(chalk.dim("reviewing test..."), true);

  // let text = prompts.summarize(gTasks, error);
  let image = await system.captureScreenBase64();

  logger.info(chalk.dim("summarizing..."), true);

  const mdStream = log.createMarkdownStreamLogger();
  let reply = await sdk.req(
    "summarize",
    {
      image,
      error: error?.toString(),
      tasks: gTasks,
    },
    (chunk) => {
      if (chunk.type === "data") {
        mdStream.log(chunk.data);
      }
    },
  );
  mdStream.end();

  let resultFile = "/tmp/oiResult.log";
  if (process.platform === "win32") {
    resultFile = "/Windows/Temp/oiResult.log";
  }
  // write reply to /tmp/oiResult.log
  fs.writeFileSync(resultFile, reply.data);
};

// this function is responsible for saving the regression test script to a file
let save = async ({ filepath = gCurrentFile, silent = false } = {}) => {

  analytics.track("save", { silent });

  if (!silent) {
    logger.info(chalk.dim("saving..."), true);
    logger.info("");
  }

  if (!gExecutionHistory.length) {
    return;
  }

  // write reply to /tmp/oiResult.log
  let regression = await generator.dumpToYML(gExecutionHistory);
  try {
    fs.writeFileSync(filepath, regression);
  } catch (e) {
    logger.error(e.message);
    logger.error("%s", e);
  }

  if (!silent) {
    log.prettyMarkdown(`Current test script:

\`\`\`yaml
${regression}
\`\`\``);

    // logger.info(gCsv.join('\n'))

    const fileName = filepath.split("/").pop();
    if (!silent) {
      logger.info(chalk.dim(`saved as ${fileName}`));
    }
  }
};

// this will load a regression test from a file location
// it parses the markdown file and executes the codeblocks exactly as if they were
// generated by the AI in a single prompt
let run = async (file, shouldSave = false, shouldExit = true) => {

  await newSession();

  setTerminalWindowTransparency(true);
  emitter.emit(events.interactive, false);

  logger.info(chalk.cyan(`running ${file}...`));

  let ymlObj = await loadYML(file);

  if (ymlObj.version) {
    let valid = isValidVersion(ymlObj.version);
    if (!valid) {
      logger.error(
        `Version mismatch: ${file}. Trying to run a test with v${ymlObj.version} test when this package is v${package.version}.`,
      );

      await summarize("Version mismatch");
      await exit(true);
    }
  }

  gExecutionHistory = [];

  for (const step of ymlObj.steps) {
    logger.info(``, null);
    logger.info(chalk.yellow(`${step.prompt || "no prompt"}`), null);

    gExecutionHistory.push({
      prompt: step.prompt,
      commands: [], // run will overwrite the commands
    });

    let markdown = `\`\`\`yaml
${yaml.dump(step)}
\`\`\``;

    logger.debug(markdown);
    logger.debug("load calling actOnMarkdown");

    gLastPrompt = step.prompt;
    await actOnMarkdown(markdown, 0, true);
  }

  if (shouldSave) {
    await save({ filepath: file });
  }

  setTerminalWindowTransparency(false);
  emitter.emit(events.interactive, true);

  if (shouldExit) {
    await summarize();
    await exit(false);
  }
};

const promptUser = () => {
  emitter.emit(events.interactive, true);
  gReadline.prompt(true);
};

const setTerminalApp = async (win) => {
  if (gTerminalApp) return;
  if (process.platform === "win32") {
    gTerminalApp = win?.title || "";
  } else {
    gTerminalApp = win?.owner?.bundleId || "";
  }
};

const iffy = async (condition, then, otherwise, depth) => {
  analytics.track("if", { condition });

  logger.info(generator.jsonToManual({ command: "if", condition }));

  let response = await commands.assert(condition);

  depth = depth + 1;

  if (response) {
    return await executeCommands(then, depth);
  } else {
    return await executeCommands(otherwise, depth);
  }
};

const embed = async (file, depth) => {
  analytics.track("embed", { file });

  logger.info(generator.jsonToManual({ command: "embed", file }));

  depth = depth + 1;

  logger.info(`${file} (start)`);

  // get the current wowrking directory where this file is being executed
  let cwd = process.cwd();

  // if the file is not an absolute path, we will try to resolve it
  if (!path.isAbsolute(file)) {
    file = path.resolve(cwd, file);
  }

  // check if the file exists
  if (!fs.existsSync(file)) {
    throw `Embedded file not found: ${file}`;
  }

  let ymlObj = await loadYML(file);

  for (const step of ymlObj.steps) {
    await executeCommands(step.commands, depth);
  }

  logger.info(`${file} (end)`);
};

const start = async ({file, command}) => {
  logger.info(chalk.green(`Howdy! I'm TestDriver v${package.version}`));
  logger.info(chalk.dim(`Working on ${file}`));
  logger.info("");
  logger.info(chalk.yellow(`This is beta software!`));
  logger.info(`Join our Discord for help`);
  logger.info(`https://discord.com/invite/cWDFW8DzPm`);
  logger.info("");

  if (!fs.existsSync(COMMAND_HISTORY_FILE)) {
    // make the file
    fs.writeFileSync(COMMAND_HISTORY_FILE, "");
  } else {
    gCommandHistory = fs
      .readFileSync(COMMAND_HISTORY_FILE, "utf-8")
      .split("\n")
      .filter((line) => {
        return line.trim() !== "";
      })
      .reverse();
  }

  if (!gCommandHistory.length) {
    gCommandHistory = [
      "open google chrome",
      "type hello world",
      "click on the current time",
    ];
  }

  // logger.info(await  system.getPrimaryDisplay());

  // @todo add-auth
  // if (!process.env.DASHCAM_API_KEY) {
  //   log('info', chalk.red(`You must supply an API key`), 'system')
  //   log('info', `Supply your API key with the \`DASHCAM_API_KEY\` environment variable.`, 'system');
  //   log('info', 'You can get a key in the Dashcam Discord server: https://discord.com/invite/cWDFW8DzPm', 'system')
  //   process.exit();
  // }

  // await sdk.auth();

  // if os is mac, check for screen capture permissions
  if (
    process.platform === "darwin" &&
    !macScreenPerms.hasScreenCapturePermission()
  ) {
    logger.info(chalk.red("Screen capture permissions not enabled."));
    logger.info(
      "You must enable screen capture permissions for the application calling `testdriverai`.",
    );
    logger.info(
      "Read More: https://docs.testdriver.ai/faq/screen-recording-permissions-mac-only",
    );
    analytics.track("noMacPermissions");
    return exit();
  }

  if (command !== "run") {
    speak("Howdy! I am TestDriver version " + package.version);

    logger.info(
      chalk.red("Warning!") +
        chalk.dim(" TestDriver sends screenshots of the desktop to our API."),
    );
    logger.info(
      chalk.dim("https://docs.testdriver.ai/security-and-privacy/agent"),
    );
    logger.info("");
  }

  // Set the global file for use in functions
  gCurrentFile = file;
  analytics.track("command", { command, file });

  if (command == "edit") {
    gExitOnError = false;
    firstPrompt();
  } else if (command == "run") {
    gErrorLimit = 100;
    gExitOnError = true;
    run(file);
  } else if (command == "init") {
    gExitOnError = false;
    await init();
    process.exit(0);
  }
};

process.on("uncaughtException", async (err) => {
  analytics.track("uncaughtException", { err });
  logger.error("Uncaught Exception: %s", err);
  // You might want to exit the process after handling the error
  await exit(true);
});

process.on("unhandledRejection", async (reason, promise) => {
  analytics.track("unhandledRejection", { reason, promise });
  logger.error("Unhandled Rejection at: %s, reason: %s", promise, reason);
  // Optionally, you might want to exit the process
  await exit(true);
});

module.exports = {
  setTerminalApp,
  start,
};
