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
const wss = require("./lib/websockets.js");
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

let lastPrompt = "";
let terminalApp = "";
let commandHistory = [];
let executionHistory = [];
let errorCounts = {};
let errorLimit = 3;
let checkCount = 0;
let checkLimit = 7;
let lastScreenshot = null;
let rl;

// list of prompts that the user has given us
let tasks = [];

let isInteractive = false;
emitter.on(events.interactive, (data) => {
  isInteractive = data;
});

// get args from terminal
const args = process.argv.slice(2);

const commandHistoryFile = path.join(os.homedir(), ".testdriver_history");

let getArgs = () => {
  let command = 0;
  let file = 1;

  // TODO use a arg parser library to simplify this
  if (
    args[command] == "--help" ||
    args[command] == "-h" ||
    args[file] == "--help" ||
    args[file] == "-h"
  ) {
    logger.info("Command: testdriverai [init, run, edit] [yaml filepath]");
    process.exit(0);
  }

  if (args[command] == "init") {
    args[command] = "init";
  } else if (args[command] !== "run" && !args[file]) {
    args[file] = args[command];
    args[command] = "edit";
  } else if (!args[command]) {
    args[command] = "edit";
  }

  if (!args[file]) {
    // make testdriver directory if it doesn't exist
    let testdriverFolder = path.join(process.cwd(), "testdriver");
    if (!fs.existsSync(testdriverFolder)) {
      fs.mkdirSync(testdriverFolder);
    }

    args[file] = "testdriver/testdriver.yaml";
  }

  // turn args[file] into local path
  if (args[file]) {
    args[file] = path.join(process.cwd(), args[file]);
    if (!args[file].endsWith(".yaml")) {
      args[file] += ".yaml";
    }
  }

  return { command: args[command], file: args[file] };
};

let a = getArgs();

const thisFile = a.file;
const thisCommand = a.command;

logger.info(chalk.green(`Howdy! I'm TestDriver v${package.version}`));
logger.info(chalk.dim(`Working on ${thisFile}`));
logger.info("");
logger.info(chalk.yellow(`This is beta software!`));
logger.info(`Join our Discord for help`);
logger.info(`https://discord.com/invite/cWDFW8DzPm`);
logger.info("");

// individual run ID for this session
// let runID = new Date().getTime();

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
  let completions = "/summarize /save /run /quit /assert /undo /manual /yml".split(
    " ",
  );
  if (line.startsWith("/run ")) {
    return fileCompleter(line);
  } else {
    completions.concat(tasks);

    var hits = completions.filter(function (c) {
      return c.indexOf(line) == 0;
    });
    // show all completions if none found
    return [hits.length ? hits : completions, line];
  }
}

if (!fs.existsSync(commandHistoryFile)) {
  // make the file
  fs.writeFileSync(commandHistoryFile, "");
} else {
  commandHistory = fs
    .readFileSync(commandHistoryFile, "utf-8")
    .split("\n")
    .filter((line) => {
      return line.trim() !== "";
    })
    .reverse();
}

if (!commandHistory.length) {
  commandHistory = [
    "open google chrome",
    "type hello world",
    "click on the current time",
  ];
}

const exit = async (failed = true, shouldSave = false) => {
  if (shouldSave) {
    await save();
  }

  analytics.track("exit", { failed });

  // we purposly never resolve this promise so the process will hang
  return new Promise(() => {
    rl?.close();
    rl?.removeAllListeners();
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
  if (thisCommand == "run" || error.fatal) {
    return await dieOnFatal(error);
  }

  let eMessage = error.message ? error.message : error;

  let safeKey = JSON.stringify(eMessage);
  errorCounts[safeKey] = errorCounts[safeKey] ? errorCounts[safeKey] + 1 : 1;

  logger.error(eMessage);

  logger.debug("%j", error);
  logger.debug("%s", error.stack);

  log.prettyMarkdown(eMessage);

  // if we get the same error 3 times in `run` mode, we exit
  if (errorCounts[safeKey] > errorLimit - 1) {
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
  checkCount++;

  if (checkCount >= checkLimit) {
    logger.info(chalk.red("Exploratory loop detected. Exiting."));
    await summarize("Check loop detected.");
    return await exit(true);
  }

  logger.info("");
  logger.info(chalk.dim("checking..."), "testdriver");
  logger.info("");

  let thisScreenshot = await system.captureScreenBase64(1, false, true);
  let images = [lastScreenshot, thisScreenshot];
  let mousePosition = await system.getMousePosition();
  let activeWindow = await system.activeWin();

  const mdStream = log.createMarkdownStreamLogger();
  let response = await sdk.req(
    "check",
    {
      tasks,
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

  lastScreenshot = thisScreenshot;

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

let lastCommand = new Date().getTime();
let csv = [["command,time"]];

const executeCommands = async (commands, depth, pushToHistory = false, dry = false) => {
  if (commands?.length) {
    for (const command of commands) {
      if (pushToHistory) {
        executionHistory[executionHistory.length - 1]?.commands.push(command);
      }

      if (!dry) {
        await runCommand(command, depth);
      }

      let timeToComplete = (new Date().getTime() - lastCommand) / 1000;
      // logger.info(timeToComplete, 'seconds')

      csv.push([command.command, timeToComplete]);
      lastCommand = new Date().getTime();
    }
  }
};

// note that commands are run in a recursive loop, so that the AI can respond to the output of the commands
// like `click-image` and `click-text` for example
const executeCodeBlocks = async (codeblocks, depth, pushToHistory = false, dry = false) => {
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

    await executeCommands(commands, depth, pushToHistory, dry);
  }
};

// this is the main function that interacts with the ai, runs commands, and checks the results
// notice that depth is 0 here. when this function resolves, the task is considered complete
// notice the call to `check()` which validates the prompt is complete
const aiExecute = async (message, validateAndLoop = false, dry = false) => {
  executionHistory.push({ prompt: lastPrompt, commands: [] });

  logger.debug("kicking off exploratory loop");
  
  // kick everything off
  await actOnMarkdown(message, 0, true, dry);

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

  let interpolationVars = JSON.parse(
    process.env["TD_INTERPOLATION_VARS"] || "{}",
  );

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
};

const assert = async (expect) => {
  analytics.track("assert");

  let task = expect;
  if (!task) {
    // set task to last value of tasks
    let task = tasks[tasks.length - 1];

    // throw error if no task
    if (!task) {
      throw new Error("No task to assert");
    }
  }

  speak("thinking...");
  notify("thinking...");
  logger.info(chalk.dim("thinking..."), true);
  logger.info("");

  let response = `\`\`\`yaml
commands:
  - command: assert
    expect: ${expect}
\`\`\``;

  await aiExecute(response);

  await save({ silent: true });
};

// this function responds to the result of `promptUser()` which is the user input
// it kicks off the exploratory loop, which is the main function that interacts with the AI
const exploratoryLoop = async (currentTask, dry = false, validateAndLoop = false) => {
  lastPrompt = currentTask;
  checkCount = 0;

  logger.debug("exploratoryLoop called");

  tasks.push(currentTask);

  speak("thinking...");
  notify("thinking...");
  logger.info(chalk.dim("thinking..."), true);
  logger.info("");

  lastScreenshot = await system.captureScreenBase64();

  const mdStream = log.createMarkdownStreamLogger();
  let message = await sdk.req(
    "input",
    {
      input: currentTask,
      mousePosition: await system.getMousePosition(),
      activeWindow: await system.activeWin(),
      image: lastScreenshot,
    },
    (chunk) => {
      if (chunk.type === "data") {
        mdStream.log(chunk.data);
      }
    },
  );
  mdStream.end();

  await aiExecute(message.data, validateAndLoop, dry);

  logger.debug("showing prompt from exploratoryLoop response check");

  await save({ silent: false });
};

const generate = async (type, count, baseYaml, skipYaml = false) => {
  logger.debug("generate called, %s", type);

  speak("thinking...");
  notify("thinking...");

  logger.info(chalk.dim("thinking..."), true);
  logger.info("");

  if (baseYaml && !skipYaml) {
    await run(baseYaml, false, false);
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

    if (baseYaml && fs.existsSync(baseYaml)) {
      list.unshift(`/run ${baseYaml} --embed`);
    }
    let contents = list
      .map((item, index) => `${index + 1}. ${item}`)
      .join("\n");
    fs.writeFileSync(path1, contents);
  }

  exit(false);
};

const popFromHistory = async (fullStep) => {
  logger.info(chalk.dim("undoing..."), true);

  if (executionHistory.length) {
    if (fullStep) {
      executionHistory.pop();
    } else {
      executionHistory[executionHistory.length - 1].commands.pop();
    }
    if (!executionHistory[executionHistory.length - 1].commands.length) {
      executionHistory.pop();
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
const actOnMarkdown = async (content, depth, pushToHistory = false, dry = false) => {
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
    let executions = await executeCodeBlocks(codeblocks, depth, pushToHistory, dry);
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
  rl = readline.createInterface({
    terminal: true,
    history: commandHistory,
    removeHistoryDuplicates: true,
    input: process.stdin,
    output: process.stdout,
    completer,
  });

  analytics.track("first prompt");

  rl.on("SIGINT", async () => {
    analytics.track("sigint");
    await exit(false);
  });

  // this is how we parse user input
  // notice that the AI is only called if the input is not a command
  const handleInput = async (input) => {
    if (!isInteractive) return;
    if (!input.trim().length) return promptUser();

    emitter.emit(events.interactive, false);
    setTerminalWindowTransparency(true);
    errorCounts = {};

    // append this to commandHistoryFile
    fs.appendFileSync(commandHistoryFile, input + "\n");

    analytics.track("input", { input });

    logger.info(""); // adds a nice break between submissions

    let commands = input
      .split(" ")
      .map((l) => l.trim())
      .filter((l) => l.length);

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
      const file = commands[1];
      const flags = commands.slice(2);
      let shouldSave = flags.includes("--save") ? true : false;
      let shouldExit = flags.includes("--exit") ? true : false;
      let shouldEmbed = flags.includes("--embed") ? true : false;

      if (shouldEmbed && (shouldSave || shouldExit)) {
        await dieOnFatal({
          message:
            "Cannot embed AND save or exit. Please either use --embed or  use any combination of --save and --exit.",
        });
      }

      if (shouldEmbed) {
        const relativePath = path.relative(
          process.cwd(),
          path.resolve(process.cwd(), file),
        );

        executionHistory.push({
          prompt: `/run ${relativePath}`,
          commands: [
            {
              command: "run",
              file: relativePath,
            },
          ],
        });
        await embed(file, 0);
      } else {
        await run(file, shouldSave, shouldExit);
      }
    } else if (input.indexOf("/generate") == 0) {
      const skipYaml = commands[4] === "--skip-yaml";
      await generate(commands[1], commands[2], commands[3], skipYaml);
    } else if (input.indexOf("/dry") == 0) {
      await exploratoryLoop(input.replace('/dry', ''), true, false);
    } else if (input.indexOf("/yml") == 0) {
      await runRawYML(commands[1]);
    } else {
      await exploratoryLoop(input, false, true);
    }

    setTerminalWindowTransparency(false);
    promptUser();
  };

  rl.on("line", handleInput);

  wss.addEventListener("input", async (message) => {
    console.log(message)
    handleInput(message.data);
  });


  // if file exists, load it
  if (fs.existsSync(thisFile)) {
    analytics.track("load");

    // this will overwrite the session if we find one in the YML
    let object = await generator.hydrateFromYML(
      fs.readFileSync(thisFile, "utf-8"),
    );

    if (!object?.steps) {
      analytics.track("load invalid yaml");
      logger.error("Invalid YAML. No steps found.");
      logger.info("Invalid YAML: " + thisFile);
      return await exit(true);
    }

    // push each step to executionHistory from { commands: {steps: [ { commands: [Array] } ] } }
    object.steps.forEach((step) => {
      executionHistory.push(step);
    });

    let yml = fs.readFileSync(thisFile, "utf-8");

    let markdown = `\`\`\`yaml
${yml}
\`\`\``;

    logger.info(`Loaded test script ${thisFile}\n`);

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
      if (terminalApp) {
        hideTerminal(terminalApp);
      }
    } else {
      if (terminalApp) {
        showTerminal(terminalApp);
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

  // let text = prompts.summarize(tasks, error);
  let image = await system.captureScreenBase64();

  logger.info(chalk.dim("summarizing..."), true);

  const mdStream = log.createMarkdownStreamLogger();
  let reply = await sdk.req(
    "summarize",
    {
      image,
      error: error?.toString(),
      tasks,
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
let save = async ({ filepath = thisFile, silent = false } = {}) => {
  analytics.track("save", { silent });

  if (!silent) {
    logger.info(chalk.dim(`saving as ${filepath}...`), true);
    logger.info("");
  }

  if (!executionHistory.length) {
    console.log('no exeuction history, not saving')
    return;
  }

  console.log('execution history', executionHistory)
  // write reply to /tmp/oiResult.log
  let regression = await generator.dumpToYML(executionHistory);
  try {
    fs.writeFileSync(filepath, regression);
  } catch (e) {
    console.log(e)
    logger.error(e.message);
    logger.error("%s", e);
  }

  if (!silent) {
    log.prettyMarkdown(`Current test script:

\`\`\`yaml
${regression}
\`\`\``);

    // logger.info(csv.join('\n'))

    const fileName = filepath.split("/").pop();
    if (!silent) {
      logger.info(chalk.dim(`saved as ${fileName}`));
    }
  }
};

let runRawYML = async (yml) => {

  const tmp = require("tmp");
  let tmpobj = tmp.fileSync();
  
  console.log("running raw yml")
  console.log(yml)
  console.log('file', tmpobj.name)

  // saved the yml to a temp file using tmp
  // and run it with run()
  fs.writeFileSync(tmpobj.name, yml);
  await run(tmpobj.name, false, true);

}

// this will load a regression test from a file location
// it parses the markdown file and executes the codeblocks exactly as if they were
// generated by the AI in a single prompt
let run = async (file = thisFile, shouldSave = false, shouldExit = true) => {
  await newSession();

  setTerminalWindowTransparency(true);
  emitter.emit(events.interactive, false);

  // get the current wowrking directory where this file is being executed
  let cwd = process.cwd();

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

  executionHistory = [];

  for (const step of ymlObj.steps) {
    logger.info(``, null);
    logger.info(chalk.yellow(`${step.prompt || "no prompt"}`), null);

    executionHistory.push({
      prompt: step.prompt,
      commands: [], // run will overwrite the commands
    });

    let markdown = `\`\`\`yaml
${yaml.dump(step)}
\`\`\``;

    logger.debug(markdown);
    logger.debug("load calling actOnMarkdown");

    lastPrompt = step.prompt;
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
  wss.sendToClients("done");
  emitter.emit(events.interactive, true);
  rl.prompt(true);
};

const setTerminalApp = async (win) => {
  if (terminalApp) return;
  if (process.platform === "win32") {
    terminalApp = win?.title || "";
  } else {
    terminalApp = win?.owner?.bundleId || "";
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

const start = async () => {
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

  if (thisCommand !== "run") {
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

  analytics.track("command", { command: thisCommand, file: thisFile });

  if (thisCommand == "edit") {
    firstPrompt();
  } else if (thisCommand == "run") {
    errorLimit = 100;
    run(thisFile);
  } else if (thisCommand == "init") {
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
