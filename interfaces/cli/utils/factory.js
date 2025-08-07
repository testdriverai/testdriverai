const BaseCommand = require("../lib/base.js");
const { createCommandDefinitions } = require("../../../agent/interface.js");

/**
 * Creates an oclif command class from a unified command definition
 */
function createOclifCommand(commandName) {
  // Get the command definition once during class creation
  const tempAgent = { workingDir: process.cwd() };
  const definitions = createCommandDefinitions(tempAgent);
  const commandDef = definitions[commandName];

  const DynamicCommand = class extends BaseCommand {
    async run() {
      try {
        const { args, flags } = await this.parse(this.constructor);

        // Special handling for edit mode
        if (commandName === "edit") {
          await this.setupAgent(args.file, flags);

          // Build environment for edit mode
          await this.agent.buildEnv(flags);

          // Start interactive mode
          const ReadlineInterface = require("../../readline.js");
          const readlineInterface = new ReadlineInterface(this.agent);
          this.agent.readlineInterface = readlineInterface;
          await readlineInterface.start();
        } else if (commandName === "init") {          
          // Simple init without full agent setup
          const fs = require("fs");
          const path = require("path");
          const prompts = require("prompts");

          console.log("🚀 Initializing TestDriver project...");

          // Create testdriver directory
          const workingDir = process.cwd();
          const testdriverDir = path.join(workingDir, "testdriver");
          if (!fs.existsSync(testdriverDir)) {
            fs.mkdirSync(testdriverDir, { recursive: true });
            console.log(`Created directory: ${testdriverDir}`);
          }

          // Get API key
          let apiKey = flags['api-key'] || process.env.TD_API_KEY;
          if (!apiKey) {
            const response = await prompts({
              type: "password",
              name: "apiKey",
              message: "Enter your TestDriver API key (from https://app.testdriver.ai/team):",
              validate: (value) => (value.length > 0 ? true : "API key is required"),
            });
            apiKey = response.apiKey;
          }

          // Get website URL
          let website = flags.website || process.env.TD_WEBSITE;
          if (!website) {
            const response = await prompts({
              type: "text",
              name: "website",
              message: "Enter the website URL to test (e.g., https://google.com): ",
              validate: (value) => {
                if (!value) value = "https://docs.testdriver.ai";
                try {
                  const urlToValidate = value.includes('://') ? value : `https://${value}`;
                  new URL(urlToValidate);
                  return true;  
                } catch {
                  return "Please enter a valid URL";
                }
              },
            });
            website = response.website;
          }

          // Write .env file
          const envPath = path.join(workingDir, ".env");
          let envContent = "";
          if (apiKey) envContent += `TD_API_KEY=${apiKey}\n`;
          if (website) envContent += `TD_WEBSITE=${website}\n`;
          envContent += `TD_THIS_FILE=My first test\n`;
          
          fs.writeFileSync(envPath, envContent);
          console.log("Created .env file");

          // Create lifecycle directory
          const lifecycleDir = path.join(testdriverDir, "lifecycle");
          if (!fs.existsSync(lifecycleDir)) {
            fs.mkdirSync(lifecycleDir, { recursive: true });
            console.log(`Created directory: ${lifecycleDir}`);
          }

          // Copy lifecycle files
          const templateDir = path.join(__dirname, "..", "..", "..", "testdriver", "lifecycle");
          const files = ["prerun.yaml", "provision.yaml", "postrun.yaml"];
          
          for (const file of files) {
            const sourcePath = path.join(templateDir, file);
            const destPath = path.join(lifecycleDir, file);
            if (fs.existsSync(sourcePath)) {
              fs.copyFileSync(sourcePath, destPath);
              console.log(`Created ${file}`);
            }
          }

          console.log("✅ Project initialized successfully!");
          console.log("Run 'testdriverai edit' to start writing tests.");
          
          process.exit(0);
        } else {
          // For run and sandbox commands, use the unified command system
          const fileArg = args.file || args.action || null;
          await this.setupAgent(fileArg, flags);

          if (commandName === "run") {
            // Set error limit higher for run command
            this.agent.errorLimit = 100;
          }

          // Execute through unified command system
          await this.agent.executeUnifiedCommand(commandName, [fileArg], flags);
        }
      } catch (error) {
        console.error(`Error executing ${commandName} command:`, error);
        process.exit(1);
      }
    }
  };

  // Set static properties directly on the class
  DynamicCommand.description = commandDef?.description || "";
  DynamicCommand.args = commandDef?.args || {};
  DynamicCommand.flags = commandDef?.flags || {};

  return DynamicCommand;
}

module.exports = { createOclifCommand };
