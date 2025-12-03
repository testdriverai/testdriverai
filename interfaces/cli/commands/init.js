const BaseCommand = require("../lib/base.js");
const { createCommandDefinitions } = require("../../../agent/interface.js");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { execSync } = require("child_process");
const readline = require("readline");

/**
 * Init command - scaffolds Vitest SDK example tests for TestDriver
 */
class InitCommand extends BaseCommand {
  async run() {
    await this.parse(InitCommand);

    console.log(chalk.cyan("\n🚀 Initializing TestDriver project...\n"));

    await this.setupPackageJson();
    await this.createVitestExample();
    await this.createGitHubWorkflow();
    await this.createGitignore();
    await this.installDependencies();
    await this.promptForApiKey();

    console.log(chalk.green("\n✅ Project initialized successfully!\n"));
    this.printNextSteps();
  }

  /**
   * Prompt user for API key and save to .env
   */
  async promptForApiKey() {
    const envPath = path.join(process.cwd(), ".env");

    // Check if .env already exists with TD_API_KEY
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf8");
      if (envContent.includes("TD_API_KEY=")) {
        console.log(chalk.gray("\n  API key already configured in .env, skipping...\n"));
        return;
      }
    }

    console.log(chalk.cyan("  Setting up your TestDriver API key...\n"));
    console.log(chalk.gray("  Get your API key from: https://console.testdriver.ai/team"));

    // Ask if user wants to open the browser
    const shouldOpen = await this.askYesNo("  Open API keys page in browser? (Y/n): ");
    if (shouldOpen) {
      try {
        // Dynamic import for ES module
        const open = (await import("open")).default;
        await open("https://console.testdriver.ai/team");
        console.log(chalk.gray("  Opening browser...\n"));
      } catch (error) {
        console.log(chalk.yellow("  ⚠️  Could not open browser automatically\n"));
      }
    }

    // Prompt for API key with hidden input
    const apiKey = await this.promptHidden("  Enter your API key (input will be hidden): ");

    if (apiKey && apiKey.trim()) {
      // Save to .env
      const envContent = fs.existsSync(envPath)
        ? fs.readFileSync(envPath, "utf8") + "\n"
        : "";

      fs.writeFileSync(envPath, envContent + `TD_API_KEY=${apiKey.trim()}\n`);
      console.log(chalk.green("\n  ✓ API key saved to .env\n"));
    } else {
      console.log(chalk.yellow("\n  ⚠️  No API key entered. You can add it later to .env:\n"));
      console.log(chalk.gray("     TD_API_KEY=your_api_key\n"));
    }
  }

  /**
   * Prompt for hidden input (like password)
   */
  async promptHidden(question) {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      // Mute output to hide the input
      const stdin = process.stdin;
      const muted = {
        write: () => {},
      };

      rl.question(question, (answer) => {
        rl.close();
        stdin.removeListener("data", muted.write);
        console.log(""); // New line after hidden input
        resolve(answer);
      });

      // Mute stdin to hide input
      stdin.on("data", (char) => {
        // Don't write to output (hides the input)
      });
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
        resolve(normalized === "" || normalized === "y" || normalized === "yes");
      });
    });
  }

  /**
   * Setup package.json if it doesn't exist
   */
  async setupPackageJson() {
    const packageJsonPath = path.join(process.cwd(), "package.json");

    if (!fs.existsSync(packageJsonPath)) {
      console.log(chalk.gray("  Creating package.json..."));

      const packageJson = {
        name: path.basename(process.cwd()),
        version: "1.0.0",
        description: "TestDriver.ai test suite",
        type: "module",
        scripts: {
          test: "vitest run",
          "test:watch": "vitest",
          "test:ui": "vitest --ui"
        },
        keywords: ["testdriver", "testing", "e2e"],
        author: "",
        license: "ISC"
      };

      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
      console.log(chalk.green(`  Created package.json`));
    } else {
      console.log(chalk.gray("  package.json already exists, skipping..."));
    }
  }

  /**
   * Create a Vitest SDK example
   */
  async createVitestExample() {
    const testDir = path.join(process.cwd(), "tests");
    const testFile = path.join(testDir, "example.test.js");
    const configFile = path.join(process.cwd(), "vitest.config.js");

    // Create test directory if it doesn't exist
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
      console.log(chalk.gray(`  Created directory: ${testDir}`));
    }

    // Create example Vitest test
    const vitestContent = `import { test, expect } from 'vitest';
import { chrome } from 'testdriverai/presets';

test('should navigate to example.com and find elements', async (context) => {
  // The chrome preset handles connection, browser launch, and cleanup automatically
  const { testdriver } = await chrome(context, {
    url: 'https://example.com'
    // apiKey automatically read from process.env.TD_API_KEY via .env file
  });

  // Find and verify elements
  const heading = await testdriver.find('heading that says Example Domain');
  expect(heading.found()).toBe(true);

  const link = await testdriver.find('More information link');
  expect(link.found()).toBe(true);
});
`;

    fs.writeFileSync(testFile, vitestContent);
    console.log(chalk.green(`  Created test file: ${testFile}`));

    // Create vitest config if it doesn't exist
    if (!fs.existsSync(configFile)) {
      const configContent = `import { defineConfig } from 'vitest/config';
import TestDriver from 'testdriverai/vitest';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export default defineConfig({
  plugins: [TestDriver()],
  test: {
    testTimeout: 120000,
    hookTimeout: 120000,
  },
});
`;

      fs.writeFileSync(configFile, configContent);
      console.log(chalk.green(`  Created config file: ${configFile}`));
    }

  }

  /**
   * Create or update .gitignore to include .env
   */
  async createGitignore() {
    const gitignorePath = path.join(process.cwd(), ".gitignore");

    let gitignoreContent = "";
    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, "utf8");

      // Check if .env is already in .gitignore
      if (gitignoreContent.includes(".env")) {
        console.log(chalk.gray("  .env already in .gitignore, skipping..."));
        return;
      }
    }

    // Add common ignores including .env
    const ignoresToAdd = [
      "",
      "# TestDriver.ai",
      ".env",
      "node_modules/",
      "test-results/",
      "*.log",
    ];

    const newContent = gitignoreContent.trim()
      ? gitignoreContent + "\n" + ignoresToAdd.join("\n") + "\n"
      : ignoresToAdd.join("\n") + "\n";

    fs.writeFileSync(gitignorePath, newContent);
    console.log(chalk.green("  Updated .gitignore"));
  }

  /**
   * Create GitHub Actions workflow
   */
  async createGitHubWorkflow() {
    const workflowDir = path.join(process.cwd(), ".github", "workflows");
    const workflowFile = path.join(workflowDir, "testdriver.yml");

    // Create .github/workflows directory if it doesn't exist
    if (!fs.existsSync(workflowDir)) {
      fs.mkdirSync(workflowDir, { recursive: true });
      console.log(chalk.gray(`  Created directory: ${workflowDir}`));
    }

    if (!fs.existsSync(workflowFile)) {
      const workflowContent = `name: TestDriver.ai Tests

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run TestDriver.ai tests
      env:
        TD_API_KEY: \${{ secrets.TD_API_KEY }}
      run: npm test

    - name: Upload test results
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: test-results
        path: test-results/
        retention-days: 30
`;

      fs.writeFileSync(workflowFile, workflowContent);
      console.log(chalk.green(`  Created GitHub workflow: ${workflowFile}`));
    } else {
      console.log(chalk.gray("  GitHub workflow already exists, skipping..."));
    }
  }

  /**
   * Install dependencies
   */
  async installDependencies() {
    console.log(chalk.cyan("\n  Installing dependencies...\n"));

    try {
      execSync("npm install -D vitest testdriverai && npm install dotenv", {
        cwd: process.cwd(),
        stdio: "inherit"
      });
      console.log(chalk.green("\n  Dependencies installed successfully!"));
    } catch (error) {
      console.log(
        chalk.yellow(
          "\n⚠️  Failed to install dependencies automatically. Please run:",
        ),
      );
      console.log(chalk.gray("     npm install -D vitest testdriverai"));
      console.log(chalk.gray("     npm install dotenv\n"));
    }
  }

  /**
   * Print next steps
   */
  printNextSteps() {
    console.log(chalk.cyan("Next steps:\n"));
    console.log("  1. Run your tests:");
    console.log(chalk.gray("     npm test\n"));
    console.log("  2. For CI/CD, add TD_API_KEY to your GitHub repository secrets");
    console.log(chalk.gray("     Settings → Secrets → Actions → New repository secret\n"));
    console.log(
      chalk.cyan("Learn more at https://docs.testdriver.ai/getting-started\n"),
    );
  }
}

// Get command definition from interface.js
const tempAgent = { workingDir: process.cwd() };
const definitions = createCommandDefinitions(tempAgent);
const commandDef = definitions["init"];

InitCommand.description = commandDef?.description || "";
InitCommand.args = commandDef?.args || {};
InitCommand.flags = commandDef?.flags || {};

module.exports = InitCommand;
