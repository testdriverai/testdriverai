const fs = require("fs");
const path = require("path");
const { execSync, spawn } = require("child_process");

/**
 * Run an npm install command with an animated progress bar
 * @param {string} cmd - The command to run (e.g. "npm")
 * @param {string[]} args - Command arguments
 * @param {string} cwd - Working directory
 * @param {string} label - Label to show (e.g. "vitest testdriverai")
 * @returns {Promise<void>}
 */
function runInstall(cmd, args, cwd, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    const barWidth = 20;
    let frame = 0;
    let status = "resolving";
    let filled = 0;

    // Parse npm stderr for progress hints
    const handleData = (data) => {
      const text = data.toString();
      if (text.includes("idealTree")) {
        status = "resolving packages";
        filled = Math.max(filled, 3);
      } else if (text.includes("reify:")) {
        status = "installing";
        filled = Math.max(filled, 8);
        // Try to extract package name from reify output
        const match = text.match(/reify:([^\s:]+)/);
        if (match) {
          status = `installing ${match[1]}`;
        }
      } else if (text.includes("timing")) {
        filled = Math.max(filled, 14);
        status = "finalizing";
      } else if (text.includes("added")) {
        filled = barWidth;
        status = "done";
      }
      // Slowly increment to show activity
      if (filled < barWidth - 2) {
        filled = Math.min(filled + 1, barWidth - 2);
      }
    };

    child.stdout.on("data", handleData);
    child.stderr.on("data", handleData);

    const isTTY = process.stderr.isTTY;

    const interval = setInterval(() => {
      frame = (frame + 1) % spinnerFrames.length;
      const spinner = spinnerFrames[frame];
      const bar = "█".repeat(filled) + "░".repeat(barWidth - filled);
      const line = `  ${spinner} ${label} [${bar}] ${status}`;
      if (isTTY) {
        process.stderr.clearLine(0);
        process.stderr.cursorTo(0);
        process.stderr.write(line);
      }
    }, 80);

    child.on("close", (code) => {
      clearInterval(interval);
      if (isTTY) {
        process.stderr.clearLine(0);
        process.stderr.cursorTo(0);
      }
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
      }
    });

    child.on("error", (err) => {
      clearInterval(interval);
      if (isTTY) {
        process.stderr.clearLine(0);
        process.stderr.cursorTo(0);
      }
      reject(err);
    });
  });
}

/**
 * Initialize a TestDriver project with all necessary files and configuration
 * @param {Object} options - Initialization options
 * @param {string} [options.targetDir] - Target directory (defaults to current working directory)
 * @param {string} [options.apiKey] - TestDriver API key (will be saved to .env)
 * @param {boolean} [options.skipInstall=false] - Skip npm install step
 * @param {boolean} [options.interactive=false] - Whether to prompt for missing values (CLI mode)
 * @param {function} [options.onProgress] - Callback for progress updates (receives message string)
 * @returns {Promise<{success: boolean, results: string[], errors: string[]}>}
 */
async function initProject(options = {}) {
  const targetDir = options.targetDir || process.cwd();
  const results = [];
  const errors = [];
  
  // Helper to report progress in real-time if callback provided
  const progress = (msg) => {
    results.push(msg);
    if (options.onProgress) {
      options.onProgress(msg);
    }
  };

  try {
    // Create target directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      progress(`✓ Created directory: ${targetDir}`);
    }

    // 1. Setup package.json
    const packageJsonPath = path.join(targetDir, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      const packageJson = {
        name: path.basename(targetDir),
        version: "1.0.0",
        description: "TestDriver.ai test suite",
        type: "module",
        scripts: {
          test: "vitest run",
          "test:watch": "vitest",
          "test:ui": "vitest --ui",
        },
        keywords: ["testdriver", "testing", "e2e"],
        author: "",
        license: "ISC",
        engines: {
          node: ">=20.19.0",
        },
      };
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
      progress("✓ Created package.json");
    } else {
      progress("⊘ package.json already exists, skipping");
    }

    // 2. Create test directory and example files
    const testDir = path.join(targetDir, "tests");
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create login snippet file
    const loginSnippetFile = path.join(testDir, "login.js");
    if (!fs.existsSync(loginSnippetFile)) {
      const loginSnippetContent = `/**
 * Login snippet - reusable login function
 * 
 * This demonstrates how to create reusable test snippets that can be
 * imported and used across multiple test files.
 */
export async function login(testdriver) {

  // The password is displayed on screen, have TestDriver extract it
  const password = await testdriver.extract('the password');

  // Find the username field
  const usernameField = await testdriver.find(
    'username input'
  );
  await usernameField.click();

  // Type username
  await testdriver.type('standard_user');

  // Enter password form earlier 
  // Marked as secret so it's not logged or stored
  await testdriver.pressKeys(['tab']);
  await testdriver.type(password, { secret: true });

  // Submit the form
  await testdriver.find('submit button on the login form').click();
}
`;
      fs.writeFileSync(loginSnippetFile, loginSnippetContent);
      progress("✓ Created login snippet: tests/login.js");
    }

    // Create example test file
    const testFile = path.join(testDir, "example.test.js");
    if (!fs.existsSync(testFile)) {
      const vitestContent = `import { test, expect } from 'vitest';
import { TestDriver } from 'testdriverai/vitest/hooks';
import { login } from './login.js';

test('should login and add item to cart', async (context) => {

  // Create TestDriver instance - automatically connects to sandbox
  const testdriver = TestDriver(context);

  // Launch chrome and navigate to demo app
  await testdriver.provision.chrome({ url: 'http://testdriver-sandbox.vercel.app/login' });

  // Use the login snippet to handle authentication
  // This demonstrates how to reuse test logic across multiple tests
  await login(testdriver);

  // Add item to cart
  const addToCartButton = await testdriver.find(
    'add to cart button under TestDriver Hat'
  );
  await addToCartButton.click();

  // Open cart
  const cartButton = await testdriver.find(
    'cart button in the top right corner'
  );
  await cartButton.click();

  // Verify item in cart
  const result = await testdriver.assert('There is an item in the cart');
  expect(result).toBeTruthy();
  
});
`;
      fs.writeFileSync(testFile, vitestContent);
      progress("✓ Created test file: tests/example.test.js");
    }

    // 3. Create vitest.config.js
    const configFile = path.join(targetDir, "vitest.config.js");
    if (!fs.existsSync(configFile)) {
      const configContent = `import { defineConfig } from 'vitest/config';
import TestDriver from 'testdriverai/vitest';

// Note: dotenv is loaded automatically by the TestDriver SDK
export default defineConfig({
  test: {
    testTimeout: 300000,
    hookTimeout: 300000,
    reporters: [
      'default',
      TestDriver(),
    ],
    setupFiles: ['testdriverai/vitest/setup'],
  },
});
`;
      fs.writeFileSync(configFile, configContent);
      progress("✓ Created vitest.config.js");
    }

    // 4. Create/update .gitignore
    const gitignorePath = path.join(targetDir, ".gitignore");
    let gitignoreContent = "";
    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
      if (!gitignoreContent.includes(".env")) {
        const ignoresToAdd = [
          "",
          "# TestDriver.ai",
          ".env",
          "node_modules/",
          "test-results/",
          "*.log",
        ];
        const newContent = gitignoreContent.trim() + "\n" + ignoresToAdd.join("\n") + "\n";
        fs.writeFileSync(gitignorePath, newContent);
        progress("✓ Updated .gitignore");
      } else {
        progress("⊘ .env already in .gitignore");
      }
    } else {
      const ignoresToAdd = [
        "# TestDriver.ai",
        ".env",
        "node_modules/",
        "test-results/",
        "*.log",
      ];
      fs.writeFileSync(gitignorePath, ignoresToAdd.join("\n") + "\n");
      progress("✓ Created .gitignore");
    }

    // 5. Create GitHub Actions workflow
    const workflowDir = path.join(targetDir, ".github", "workflows");
    if (!fs.existsSync(workflowDir)) {
      fs.mkdirSync(workflowDir, { recursive: true });
    }

    const workflowFile = path.join(workflowDir, "testdriver.yml");
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
      run: vitest run

    - name: Upload test results
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: test-results
        path: test-results/
        retention-days: 30
`;
      fs.writeFileSync(workflowFile, workflowContent);
      progress("✓ Created GitHub workflow: .github/workflows/testdriver.yml");
    } else {
      progress("⊘ GitHub workflow already exists");
    }

    // 6. Create VSCode MCP config
    const vscodeDir = path.join(targetDir, ".vscode");
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }

    const mcpConfigFile = path.join(vscodeDir, "mcp.json");
    if (!fs.existsSync(mcpConfigFile)) {
      const mcpConfig = {
        inputs: [
          {
            type: "promptString",
            id: "testdriver-api-key",
            description: "TestDriver API Key From https://console.testdriver.ai/team",
            password: true,
          },
        ],
        servers: {
          testdriver: {
            command: "npx",
            args: ["-p", "testdriverai", "testdriverai-mcp"],
            env: {
              TD_API_KEY: "${input:testdriver-api-key}",
            },
          },
        },
      };
      fs.writeFileSync(mcpConfigFile, JSON.stringify(mcpConfig, null, 2) + "\n");
      progress("✓ Created MCP config: .vscode/mcp.json");
    } else {
      progress("⊘ MCP config already exists");
    }

    // 7. Create VSCode extensions recommendations
    const extensionsFile = path.join(vscodeDir, "extensions.json");
    if (!fs.existsSync(extensionsFile)) {
      const extensionsConfig = {
        recommendations: [
          "vitest.explorer",
        ],
      };
      fs.writeFileSync(extensionsFile, JSON.stringify(extensionsConfig, null, 2) + "\n");
      progress("✓ Created extensions config: .vscode/extensions.json");
    } else {
      progress("⊘ Extensions config already exists");
    }

    // 8. Copy TestDriver skills
    const skillsDestDir = path.join(targetDir, ".github", "skills");
    const possibleSkillsSources = [
      path.join(targetDir, "node_modules", "testdriverai", "ai", "skills"),
      path.join(__dirname, "..", "ai", "skills"),
    ];

    let skillsSourceDir = null;
    for (const source of possibleSkillsSources) {
      if (fs.existsSync(source)) {
        skillsSourceDir = source;
        break;
      }
    }

    if (skillsSourceDir) {
      if (!fs.existsSync(skillsDestDir)) {
        fs.mkdirSync(skillsDestDir, { recursive: true });
      }

      const skillDirs = fs.readdirSync(skillsSourceDir);
      let copiedCount = 0;

      for (const skillDir of skillDirs) {
        const sourcePath = path.join(skillsSourceDir, skillDir);
        const destPath = path.join(skillsDestDir, skillDir);

        if (fs.statSync(sourcePath).isDirectory()) {
          if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath, { recursive: true });
          }

          const skillFile = path.join(sourcePath, "SKILL.md");
          if (fs.existsSync(skillFile)) {
            fs.copyFileSync(skillFile, path.join(destPath, "SKILL.md"));
            copiedCount++;
          }
        }
      }

      if (copiedCount > 0) {
        progress(`✓ Copied ${copiedCount} skills to .github/skills/`);
      }
    } else {
      progress("⚠ Skills directory not found (will be available after npm install)");
    }

    // 9. Copy TestDriver agents
    const agentsDestDir = path.join(targetDir, ".github", "agents");
    const possibleAgentsSources = [
      path.join(targetDir, "node_modules", "testdriverai", "ai", "agents"),
      path.join(__dirname, "..", "ai", "agents"),
    ];

    let agentsSourceDir = null;
    for (const source of possibleAgentsSources) {
      if (fs.existsSync(source)) {
        agentsSourceDir = source;
        break;
      }
    }

    if (agentsSourceDir) {
      if (!fs.existsSync(agentsDestDir)) {
        fs.mkdirSync(agentsDestDir, { recursive: true });
      }

      const agentFiles = fs.readdirSync(agentsSourceDir).filter(f => f.endsWith(".md"));
      let copiedCount = 0;

      for (const agentFile of agentFiles) {
        const sourcePath = path.join(agentsSourceDir, agentFile);
        const agentName = agentFile.replace(".md", "");
        const destPath = path.join(agentsDestDir, `${agentName}.agent.md`);

        if (!fs.existsSync(destPath)) {
          fs.copyFileSync(sourcePath, destPath);
          copiedCount++;
        }
      }

      if (copiedCount > 0) {
        progress(`✓ Copied ${copiedCount} agent(s) to .github/agents/`);
      }

      // Also set testdriver.md as copilot-instructions.md if it doesn't already exist
      const copilotInstructionsPath = path.join(targetDir, ".github", "copilot-instructions.md");
      const testdriverAgentSource = path.join(agentsSourceDir, "testdriver.md");
      if (!fs.existsSync(copilotInstructionsPath) && fs.existsSync(testdriverAgentSource)) {
        fs.copyFileSync(testdriverAgentSource, copilotInstructionsPath);
        progress("✓ Created .github/copilot-instructions.md");
      } else if (fs.existsSync(copilotInstructionsPath)) {
        progress("⊘ copilot-instructions.md already exists, skipping");
      }
    } else {
      progress("⚠ Agents directory not found (will be available after npm install)");
    }

    // 10. Handle API key if provided
    if (options.apiKey) {
      const envPath = path.join(targetDir, ".env");
      let envContent = "";
      
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, "utf8");
        if (!envContent.includes("TD_API_KEY=")) {
          envContent += "\n";
        } else {
          // Replace existing key
          envContent = envContent.replace(/^TD_API_KEY=.*$/m, "");
        }
      }
      
      const newEnvContent = envContent.trim() + `\nTD_API_KEY=${options.apiKey}\n`;
      fs.writeFileSync(envPath, newEnvContent);
      progress("✓ Saved API key to .env");
    } else {
      progress("ℹ No API key provided - add it to .env manually:");
      progress("  TD_API_KEY=your_api_key");
    }

    // 11. Install dependencies (unless skipped)
    if (!options.skipInstall) {
      progress("\n📦 Installing dependencies...");
      try {
        await runInstall("npm", ["install", "-D", "vitest", "testdriverai"], targetDir, "vitest testdriverai");
        progress("✓ Installed vitest, testdriverai");
        await runInstall("npm", ["install", "dotenv"], targetDir, "dotenv");
        progress("✓ Installed dotenv");
      } catch (error) {
        errors.push("Failed to install dependencies. Run manually:");
        errors.push("  npm install -D vitest testdriverai");
        errors.push("  npm install dotenv");
      }
    } else {
      progress("\nℹ Skipped dependency installation. Run manually:");
      progress("  npm install -D vitest testdriverai");
      progress("  npm install dotenv");
    }

    return { success: true, results, errors };
  } catch (error) {
    errors.push(`Initialization failed: ${error.message}`);
    return { success: false, results, errors };
  }
}

module.exports = { initProject };
