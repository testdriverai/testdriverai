const { Command } = require("@oclif/core");
const { createCommandDefinitions } = require("../../../agent/interface.js");
const fs = require("fs");
const path = require("path");
const os = require("os");
const chalk = require("chalk");
const { execSync } = require("child_process");
const readline = require("readline");

const PACKAGE_ROOT = path.resolve(__dirname, "..", "..", "..");
const CLAUDE_HOME = path.join(os.homedir(), ".claude");
const CLAUDE_MCP_FILE = path.join(os.homedir(), ".claude.json");
const CURSOR_MCP_FILE = path.join(os.homedir(), ".cursor", "mcp.json");

const MCP_SERVER_CONFIG = {
  "testdriver-cloud": {
    type: "sse",
    url: "https://replayable-dev-ian-mac-m1-16.ngrok.io/api/v1/mcp",
    headers: {
      "x-api-key": "${TD_API_KEY}",
    },
    description:
      "Query TestDriver test runs, test cases, and filters for your team using an API key.",
  },
};

const CURSOR_MCP_SERVER_CONFIG = {
  "testdriver-cloud": {
    type: "sse",
    url: "https://replayable-dev-ian-mac-m1-16.ngrok.io/api/v1/mcp",
    headers: {
      "x-api-key": "${TD_API_KEY}",
    },
    description:
      "Query TestDriver test runs, test cases, and filters for your team using an API key.",
  },
};

class SetupCommand extends Command {
  async run() {
    await this.parse(SetupCommand);

    console.log(chalk.cyan("\nSetting up TestDriver for Claude Code...\n"));

    const sourceSkills = path.join(PACKAGE_ROOT, "claude-testdriver", "skills");
    const sourceAgents = path.join(PACKAGE_ROOT, "claude-testdriver", "agents");

    this.installSkills(sourceSkills, path.join(CLAUDE_HOME, "skills"));
    this.installAgents(sourceAgents, path.join(CLAUDE_HOME, "agents"));
    this.installMcp();
    this.installCursorMcp();
    await this.promptForApiKey();

    console.log(chalk.green("\nSetup complete!\n"));
    this.printNextSteps();
    process.exit(0);
  }

  /**
   * Recursively copy a directory's contents
   */
  copyDirSync(src, dest) {
    fs.mkdirSync(dest, { recursive: true });

    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirSync(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Install skills to ~/.claude/skills
   */
  installSkills(source, dest) {
    if (!fs.existsSync(source)) {
      console.log(
        chalk.yellow("  Skills source not found, skipping: " + source),
      );
      return;
    }

    const skills = fs
      .readdirSync(source, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const skill of skills) {
      const srcDir = path.join(source, skill.name);
      const destDir = path.join(dest, skill.name);
      this.copyDirSync(srcDir, destDir);
    }

    console.log(chalk.green(`  Installed ${skills.length} skills to ${dest}`));
  }

  /**
   * Install agents to ~/.claude/agents
   */
  installAgents(source, dest) {
    if (!fs.existsSync(source)) {
      console.log(
        chalk.yellow("  Agents source not found, skipping: " + source),
      );
      return;
    }

    fs.mkdirSync(dest, { recursive: true });

    const agents = fs.readdirSync(source).filter((f) => f.endsWith(".md"));

    for (const agent of agents) {
      fs.copyFileSync(path.join(source, agent), path.join(dest, agent));
    }

    console.log(
      chalk.green(`  Installed ${agents.length} agent(s) to ${dest}`),
    );
  }

  /**
   * Add testdriver MCP server to ~/.claude.json
   */
  installMcp() {
    let config = {};

    if (fs.existsSync(CLAUDE_MCP_FILE)) {
      try {
        config = JSON.parse(fs.readFileSync(CLAUDE_MCP_FILE, "utf8"));
      } catch {
        // If the file is malformed, start fresh but warn
        console.log(
          chalk.yellow(
            "  Warning: existing ~/.claude.json was not valid JSON, overwriting",
          ),
        );
      }
    }

    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    const alreadyConfigured = config.mcpServers["testdriver-cloud"];

    Object.assign(config.mcpServers, MCP_SERVER_CONFIG);
    fs.writeFileSync(CLAUDE_MCP_FILE, JSON.stringify(config, null, 2) + "\n");

    if (alreadyConfigured) {
      console.log(
        chalk.green(`  Updated testdriver MCP server in ${CLAUDE_MCP_FILE}`),
      );
    } else {
      console.log(
        chalk.green(`  Added testdriver MCP server to ${CLAUDE_MCP_FILE}`),
      );
    }
  }

  /**
   * Add testdriver MCP server to ~/.cursor/mcp.json
   */
  installCursorMcp() {
    const cursorDir = path.dirname(CURSOR_MCP_FILE);
    fs.mkdirSync(cursorDir, { recursive: true });

    let config = {};

    if (fs.existsSync(CURSOR_MCP_FILE)) {
      try {
        config = JSON.parse(fs.readFileSync(CURSOR_MCP_FILE, "utf8"));
      } catch {
        console.log(
          chalk.yellow(
            "  Warning: existing ~/.cursor/mcp.json was not valid JSON, overwriting",
          ),
        );
      }
    }

    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    const alreadyConfigured = config.mcpServers["testdriver-cloud"];

    Object.assign(config.mcpServers, CURSOR_MCP_SERVER_CONFIG);
    fs.writeFileSync(CURSOR_MCP_FILE, JSON.stringify(config, null, 2) + "\n");

    if (alreadyConfigured) {
      console.log(
        chalk.green(`  Updated testdriver MCP server in ${CURSOR_MCP_FILE}`),
      );
    } else {
      console.log(
        chalk.green(`  Added testdriver MCP server to ${CURSOR_MCP_FILE}`),
      );
    }
  }

  /**
   * Prompt user for API key and save globally to shell profile
   */
  async promptForApiKey() {
    // Check if TD_API_KEY is already set in the environment
    if (process.env.TD_API_KEY) {
      console.log(
        chalk.gray("\n  API key already set in environment, skipping...\n"),
      );
      return;
    }

    console.log(chalk.cyan("\n  Setting up your TestDriver API key...\n"));
    console.log(
      chalk.gray("  Get your API key from: https://console.testdriver.ai/team"),
    );

    const shouldOpen = await this.askYesNo(
      "  Open API keys page in browser? (Y/n): ",
    );
    if (shouldOpen) {
      try {
        const open = (await import("open")).default;
        await open("https://console.testdriver.ai/team");
        console.log(chalk.gray("  Opening browser...\n"));
      } catch (error) {
        console.log(
          chalk.yellow("  Could not open browser automatically\n"),
        );
      }
    }

    const apiKey = await this.promptHidden(
      "  Enter your API key (input will be hidden): ",
    );

    if (apiKey && apiKey.trim()) {
      this.addToShellProfile("TD_API_KEY", apiKey.trim());
      process.env.TD_API_KEY = apiKey.trim();
    } else {
      console.log(
        chalk.yellow(
          "\n  No API key entered. You can set it later:\n",
        ),
      );
      console.log(chalk.gray('     export TD_API_KEY="your_api_key"\n'));
    }
  }

  /**
   * Prompt for hidden input (like password)
   */
  async promptHidden(question) {
    return new Promise((resolve) => {
      process.stdout.write(question);

      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding("utf8");

      let input = "";

      const onData = (char) => {
        if (char === "\u0003") {
          stdin.setRawMode(wasRaw);
          process.exit();
        }
        if (char === "\r" || char === "\n") {
          stdin.setRawMode(wasRaw);
          stdin.removeListener("data", onData);
          stdin.pause();
          console.log("");
          resolve(input);
          return;
        }
        if (char === "\u007F" || char === "\b") {
          input = input.slice(0, -1);
          return;
        }
        input += char;
      };

      stdin.on("data", onData);
    });
  }

  /**
   * Ask a yes/no question
   */
  async askYesNo(question) {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question(question, (answer) => {
        rl.close();
        const normalized = answer.toLowerCase().trim();
        resolve(
          normalized === "" || normalized === "y" || normalized === "yes",
        );
      });
    });
  }

  /**
   * Add an environment variable export to the user's shell profile
   */
  addToShellProfile(key, value) {
    if (process.platform === "win32") {
      try {
        execSync(`setx ${key} "${value}"`, { stdio: "ignore" });
        console.log(
          chalk.green(`\n  Set ${key} as user environment variable\n`),
        );
      } catch (error) {
        console.log(
          chalk.yellow(`\n  Could not set ${key} via setx. You can set it manually:\n`),
        );
        console.log(chalk.gray(`     setx ${key} "your_api_key"\n`));
      }
      return;
    }

    const shell = process.env.SHELL || "/bin/bash";
    const home = os.homedir();
    let profilePath;

    if (shell.includes("zsh")) {
      profilePath = path.join(home, ".zshrc");
    } else {
      profilePath = path.join(home, ".bashrc");
    }

    const exportLine = `export ${key}="${value}"`;

    if (fs.existsSync(profilePath)) {
      const content = fs.readFileSync(profilePath, "utf8");
      if (content.includes(`export ${key}=`)) {
        const updated = content.replace(
          new RegExp(`^export ${key}=.*$`, "m"),
          exportLine,
        );
        fs.writeFileSync(profilePath, updated);
        console.log(
          chalk.green(`\n  Updated ${key} in ${profilePath}\n`),
        );
        return;
      }
    }

    fs.appendFileSync(profilePath, `\n${exportLine}\n`);
    console.log(
      chalk.green(`\n  Added ${key} to ${profilePath}\n`),
    );
  }

  printNextSteps() {
    console.log(chalk.cyan("Next steps:\n"));
    console.log("  1. Restart Claude Code to pick up the new MCP server\n");
  }
}

// Get command definition from interface.js
const tempAgent = { workingDir: process.cwd() };
const definitions = createCommandDefinitions(tempAgent);
const commandDef = definitions["setup"];

SetupCommand.description =
  commandDef?.description ||
  "Set up TestDriver skills, agents, and MCP for Claude Code";
SetupCommand.args = commandDef?.args || {};
SetupCommand.flags = commandDef?.flags || {};

module.exports = SetupCommand;
