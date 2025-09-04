const readline = require("readline");
const fs = require("fs");
const path = require("path");
const os = require("os");

// local modules
const parser = require("../agent/lib/parser.js");
const generator = require("../agent/lib/generator.js");
const { events } = require("../agent/events.js");

class ReadlineInterface {
  constructor(agent) {
    this.agent = agent;
    this.rl = null;
    this.commandHistoryFile = path.join(os.homedir(), ".testdriver_history");
    this.commandHistory = [];

    this.initializeCommandHistory();
  }

  initializeCommandHistory() {
    // initialize the command history from the file
    if (!fs.existsSync(this.commandHistoryFile)) {
      // make the file
      fs.writeFileSync(this.commandHistoryFile, "");
    } else {
      this.commandHistory = fs
        .readFileSync(this.commandHistoryFile, "utf-8")
        .split("\n")
        .filter((line) => {
          return line.trim() !== "";
        })
        .reverse();
    }

    // populate command history with some default commands
    if (!this.commandHistory.length) {
      this.commandHistory = [
        "open google chrome",
        "type hello world",
        "click on the current time",
      ];
    }
  }

  // this function is used to complete file paths in the /run command in interactive mode
  fileCompleter(line) {
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
      const dirPath = path.resolve(this.agent.workingDir, dir);

      let files = fs.readdirSync(dirPath);
      files = files.map((file) => {
        const fullFilePath = path.join(dirPath, file);
        const fileStats = fs.statSync(fullFilePath);
        return file + (fileStats.isDirectory() ? path.sep : ""); // add path.sep for dir
      });
      const matches = files.filter((file) => file.startsWith(partial));

      return [matches.length ? matches : files, partial];
    } catch (e) {
      this.agent.emitter.emit(events.log.log, "%s", e);
      return [[], partial];
    }
  }

  // this function is used to complete commands in interactive mode
  completer(line) {
    const commands = this.agent.getCommandDefinitions();
    let completions = Object.keys(commands).map((cmd) => `/${cmd}`);

    if (line.startsWith("/run ")) {
      return this.fileCompleter(line);
    } else {
      completions = completions.concat(this.agent.tasks);

      var hits = completions.filter(function (c) {
        return c.indexOf(line) == 0;
      });
      // show all completions if none found
      return [hits.length ? hits : completions, line];
    }
  }

  // this is how we parse user input using the unified command system
  async handleInput(input) {
    if (!input.trim().length) return this.promptUser();

    this.agent.errorCounts = {};

    // append this to commandHistoryFile
    fs.appendFileSync(this.commandHistoryFile, input + "\n");

    this.agent.analytics.track("input", { input });

    this.agent.emitter.emit(events.log.log, ""); // adds a nice break between submissions

    // Inject environment variables into any ${VAR} strings
    input = parser.interpolate(input, this.agent.config._environment);

    try {
      // Parse interactive commands (starting with /)
      if (input.startsWith("/") && !input.startsWith("/explore")) {
        const parts = input.slice(1).split(" ");
        const commandName = parts[0];
        const args = parts.slice(1);

        // Parse options (flags starting with --)
        const options = {};
        const cleanArgs = [];

        for (let i = 0; i < args.length; i++) {
          const arg = args[i];
          if (arg.startsWith("--")) {
            // Handle both --flag=value and --flag value formats
            if (arg.includes("=")) {
              // --flag=value format
              const [fullFlag, ...valueParts] = arg.split("=");
              const optName = fullFlag.slice(2);
              const value = valueParts.join("="); // rejoin in case value contains =
              options[optName] = value;
            } else {
              // --flag value format
              const optName = arg.slice(2);
              if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
                options[optName] = args[i + 1];
                i++; // skip the next argument as it's the value
              } else {
                options[optName] = true;
              }
            }
          } else {
            cleanArgs.push(arg);
          }
        }

        // Use unified command system
        await this.agent.executeUnifiedCommand(commandName, cleanArgs, options);
      } else {
        // Handle regular exploratory input
        await this.agent.exploratoryLoop(
          input.replace(/^\/explore\s+/, ""),
          false,
          true,
          true,
        );
      }
    } catch (error) {
      console.error(error);

      this.agent.emitter.emit(
        events.error.general,
        "Command error:",
        error.message,
      );
    }

    this.promptUser();
  }

  async start() {
    // readline is what allows us to get user input
    this.rl = readline.createInterface({
      terminal: true,
      history: this.commandHistory,
      removeHistoryDuplicates: true,
      input: process.stdin,
      output: process.stdout,
      completer: this.completer.bind(this),
    });

    this.rl.on("SIGINT", async () => {
      this.agent.analytics.track("sigint");
      await this.agent.exit(false);
    });

    this.rl.on("line", this.handleInput.bind(this));

    // if file exists, load it
    if (fs.existsSync(this.agent.thisFile)) {
      this.agent.analytics.track("load");

      // this will overwrite the session if we find one in the YML
      let object = await generator.hydrateFromYML(
        fs.readFileSync(this.agent.thisFile, "utf-8"),
      );

      // push each step to executionHistory from { commands: {steps: [ { commands: [Array] } ] } }
      object.steps?.forEach((step) => {
        this.agent.executionHistory.push(step);
      });

      let yml = fs.readFileSync(this.agent.thisFile, "utf-8");

      if (yml) {
        let markdown = `\`\`\`yaml
${yml}\`\`\``;

        this.agent.emitter.emit(
          events.log.log,
          `Loaded test script ${this.agent.thisFile}\n`,
        );
        this.agent.emitter.emit(events.log.markdown.static, markdown);
        this.agent.emitter.emit(
          events.log.log,
          "New commands will be appended.",
        );
      }
    }

    this.promptUser();
  }

  promptUser() {
    process.nextTick(() => this.rl.prompt());
  }

  close() {
    this.rl?.close();
    this.rl?.removeAllListeners();
  }
}

module.exports = ReadlineInterface;
