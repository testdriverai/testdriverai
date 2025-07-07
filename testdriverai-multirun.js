#!/usr/bin/env node

// testdriverai-multirun.js
// Multi-file runner for TestDriverAgent with glob, listr2, and JUnit reporting

const path = require("path");
const fs = require("fs");
const { fork } = require("child_process");
const glob = require("glob");
const { Listr } = require("listr2");
const junit = require("junit-report-builder");
const yargs = require("yargs");

// Parse CLI args (mimic agent.js style)
const argv = yargs
  .usage("Usage: $0 <glob> [options]")
  .option("summary", {
    type: "string",
    describe: "Output summary file",
  })
  .demandCommand(1)
  .help().argv;

const pattern = argv._[0];
const summaryFile = argv.summary;

// Find all matching YAML files
const files = glob.sync(pattern, { absolute: true });
if (!files.length) {
  console.error(`No files matched pattern: ${pattern}`);
  process.exit(1);
}

// Helper: Parse YAML and return steps/commands structure
function getStepsAndCommands(file) {
  try {
    const yaml = require("js-yaml");
    const content = fs.readFileSync(file, "utf-8");
    const doc = yaml.load(content);
    if (!doc || !Array.isArray(doc.steps)) return [];
    return doc.steps.map((step) => ({
      prompt: step.prompt || "",
      commands: Array.isArray(step.commands)
        ? step.commands.map((c) => c.command || "unknown")
        : [],
    }));
  } catch {
    return [];
  }
}

// Helper: Run a single test file in a child process, collect events, and track command progress
function runTestFileWithListr(file, stepTasks) {
  return new Promise((resolve) => {
    const child = fork(
      path.join(__dirname, "index.js"),
      ["run", file, "--new-sandbox"],
      {
        stdio: ["ignore", "pipe", "pipe", "ipc"],
        env: process.env,
      },
    );
    const events = [];
    let output = "";
    let errorOutput = "";
    // Track which step/command is running
    let currentStep = 0;
    let currentCommand = 0;
    child.on("message", (msg) => {
      if (
        msg &&
        typeof msg === "object" &&
        msg.type &&
        (msg.type.startsWith("step:") ||
          msg.type.startsWith("command:") ||
          msg.type.startsWith("test:"))
      ) {
        events.push(msg);
        // Advance subtask progress
        if (msg.type === "step:start") {
          // Find step index by prompt or order
          if (typeof msg.jsonPath === "string") {
            const match = msg.jsonPath.match(/\\[(\\d+)\\]/);
            if (match) currentStep = parseInt(match[1], 10);
          } else if (Array.isArray(msg.yamlPath)) {
            currentStep = msg.yamlPath[0] || 0;
          }
          currentCommand = 0;
        }
        if (msg.type === "command:success" || msg.type === "command:complete") {
          if (
            stepTasks[currentStep] &&
            stepTasks[currentStep].subtasks[currentCommand]
          ) {
            stepTasks[currentStep].subtasks[currentCommand].complete();
          }
          currentCommand++;
        }
      }
    });
    child.stdout.on("data", (data) => {
      output += data.toString();
    });
    child.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });
    child.on("exit", (code) => {
      resolve({ file, code, events, output, errorOutput });
    });
  });
}

// Listr2 tasks for all files, with sub-lists for steps/commands
const tasks = files.map((file) => {
  const stepsAndCommands = getStepsAndCommands(file);
  // Build subtasks for each step/command
  const stepTasks = stepsAndCommands.map((step, stepIdx) => {
    const subtasks = step.commands.map((cmd, cmdIdx) => ({
      title: cmd,
      task: async (_, subtask) => {
        // Wait for parent to mark as complete via IPC
        return new Promise((resolve) => {
          subtask.complete = resolve;
        });
      },
    }));
    return {
      title: step.prompt ? `Step: ${step.prompt}` : `Step ${stepIdx + 1}`,
      subtasks,
      task: async () => {}, // No-op, only subtasks matter
    };
  });
  return {
    title: path.basename(file),
    task: async (ctx, task) => {
      // Compose a Listr for steps/commands
      const Listr = require("listr2").Listr;
      const subListr = new Listr(
        stepTasks.map((step) => ({
          title: step.title,
          task: step.subtasks.length
            ? () => new Listr(step.subtasks, { concurrent: false })
            : async () => {},
        })),
        { concurrent: false, exitOnError: false },
      );
      const resultPromise = runTestFileWithListr(file, stepTasks);
      await subListr.run();
      const result = await resultPromise;
      ctx.results = ctx.results || [];
      ctx.results.push(result);
      if (result.code === 0) {
        task.output = "Passed";
      } else {
        task.output = "Failed";
        throw new Error("Test failed");
      }
    },
    options: { persistentOutput: true },
  };
});

(async () => {
  // Ensure cli-progress is installed
  try {
    require.resolve("cli-progress");
  } catch (e) {
    console.error(
      "cli-progress is required. Please run: npm install cli-progress",
    );
    process.exit(1);
  }
  const ctx = {};
  const runner = new Listr(tasks, { concurrent: true, exitOnError: false });
  await runner.run(ctx);

  // Build JUnit report
  const suite = junit.testSuite().name("TestDriverAI Suite");
  for (const result of ctx.results) {
    const testCase = suite
      .testCase()
      .className("TestDriverAI")
      .name(path.basename(result.file));
    // Attach step/command/test events as system-out
    const eventLines = result.events
      .map((e) => {
        const base = `[${e.type}]`;
        if (e.sourcemap && e.sourcemap.start) {
          return `${base} ${JSON.stringify(e, null, 2)} (YAML line ${e.sourcemap.start.line})`;
        }
        return `${base} ${JSON.stringify(e, null, 2)}`;
      })
      .join("\n");
    testCase.systemOut(`${result.output}\n${eventLines}`);
    if (result.code !== 0) {
      testCase.failure(result.errorOutput || "Test failed");
    }
  }
  const xml = junit.build();
  const junitFile = summaryFile || path.join(process.cwd(), "junit-report.xml");
  fs.writeFileSync(junitFile, xml);
  console.log(`JUnit report written to: ${junitFile}`);

  // Exit with nonzero if any failed
  const anyFailed = ctx.results.some((r) => r.code !== 0);
  process.exit(anyFailed ? 1 : 0);
})();
