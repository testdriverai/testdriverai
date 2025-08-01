const fs = require("fs");
const path = require("path");
const { events } = require("../agent/events.js");
const builder = require("junit-report-builder");
const stripAnsi = require("strip-ansi");

/**
 * JUnit XML Reporter for TestDriver
 *
 * Subscribes to TestDriver events and generates JUnit XML reports
 * following the hierarchy:
 * - Test Suite: folder path from "testdriver" root
 * - Test Case: individual test file
 *   - Contains system-out from log:* events (ANSI codes stripped)
 *   - Contains system-err from error:* events (ANSI codes stripped)
 *   - Properties for each step (prompt) and their status
 */
class JUnitReporter {
  constructor(emitter, outputFilePath, mainTestFile) {
    this.emitter = emitter;
    this.outputFilePath = outputFilePath;
    this.mainTestFile = mainTestFile;

    // Current test state
    this.currentTest = null;
    this.currentTestCase = null;

    // Single test suite for the run (based on main test file)
    this.testSuite = null;

    // Accumulate logs and errors for system-out/system-err
    this.systemOut = [];
    this.systemErr = [];

    // Track step results for properties
    this.stepResults = [];

    // Track command results (including assertions)
    this.commandResults = [];

    // Track timing
    this.testStartTime = null;

    // Create test suite based on main test file
    this.createTestSuite();

    this.setupEventListeners();
  }

  createTestSuite() {
    // Create test suite based on the main test file's folder
    const suiteName = this.getTestSuiteName(this.mainTestFile);
    this.testSuite = builder.testSuite().name(suiteName);
  }

  setupEventListeners() {
    console.log("[JUnit Reporter] Setting up event listeners...");
    // Test lifecycle events
    this.emitter.on(events.test.start, (data) => this.handleTestStart(data));
    this.emitter.on(events.test.success, (data) =>
      this.handleTestEnd(data, "passed"),
    );
    this.emitter.on(events.test.error, (data) =>
      this.handleTestEnd(data, "failed"),
    );
    this.emitter.on(
      events.test.stop,
      (data) => this.handleTestEnd(data, "passed"), // Assume passed if just stopped
    );

    // Step lifecycle events
    this.emitter.on(events.step.start, (data) => this.handleStepStart(data));
    this.emitter.on(events.step.success, (data) =>
      this.handleStepEnd(data, "passed"),
    );
    this.emitter.on(events.step.error, (data) =>
      this.handleStepEnd(data, "failed"),
    );

    // Command lifecycle events (including assertions)
    this.emitter.on(events.command.start, (data) =>
      this.handleCommandStart(data),
    );
    this.emitter.on(events.command.success, (data) =>
      this.handleCommandEnd(data, "passed"),
    );
    this.emitter.on(events.command.error, (data) =>
      this.handleCommandEnd(data, "failed"),
    );

    // Log and error events for system-out/system-err
    this.emitter.on("log:*", (message) =>
      this.handleLogMessage(message, "log"),
    );
    this.emitter.on("error:*", (error) =>
      this.handleErrorMessage(error, "error"),
    );

    // Handle exit to finalize report
    this.emitter.on(events.exit, () => this.finalizeReport());
    console.log("[JUnit Reporter] Event listeners setup complete");
  }

  handleTestStart(data) {
    console.log("[JUnit Reporter] handleTestStart called with:", data);
    const { filePath, timestamp } = data;
    this.currentTest = { filePath, timestamp };
    this.testStartTime = timestamp;

    // Reset state for this test
    this.systemOut = [];
    this.systemErr = [];
    this.stepResults = [];
    this.commandResults = [];

    // Create test case for the test file
    const fileName = path.basename(filePath);
    this.currentTestCase = this.testSuite
      .testCase()
      .className(this.getTestSuiteName(this.mainTestFile))
      .name(fileName);
    console.log("[JUnit Reporter] Created test case for:", fileName);
  }

  handleTestEnd(data, status) {
    console.log(
      "[JUnit Reporter] handleTestEnd called with status:",
      status,
      "data:",
      data,
    );
    const duration = this.testStartTime
      ? (data.timestamp - this.testStartTime) / 1000
      : 0;

    // Set test case duration
    this.currentTestCase.time(duration);

    // Add step results as properties
    this.stepResults.forEach((step, index) => {
      this.currentTestCase.property(
        `step${index + 1}[${step.status}]`,
        step.prompt,
      );
    });

    // Add command results (including assertions) as properties
    this.commandResults.forEach((command, index) => {
      if (command.command === "assert") {
        this.currentTestCase.property(
          `assertion${index + 1}[${command.status}]`,
          command.expect || "assertion",
        );
      } else {
        this.currentTestCase.property(
          `command${index + 1}[${command.status}]`,
          `${command.command}: ${command.description || ""}`,
        );
      }
    });

    // Add system-out and system-err
    if (this.systemOut.length > 0) {
      this.currentTestCase.standardOutput(this.systemOut.join("\n"));
    }
    if (this.systemErr.length > 0) {
      this.currentTestCase.standardError(this.systemErr.join("\n"));
    }

    console.log(
      "[JUnit Reporter] Test completed - Steps:",
      this.stepResults.length,
      "Commands:",
      this.commandResults.length,
      "Logs:",
      this.systemOut.length,
      "Errors:",
      this.systemErr.length,
    );

    // Mark test as failed if any step failed or if overall status is failed
    const hasFailedSteps = this.stepResults.some(
      (step) => step.status === "failed",
    );
    const hasFailedCommands = this.commandResults.some(
      (command) => command.status === "failed",
    );

    if (status === "failed" || hasFailedSteps || hasFailedCommands) {
      const failedSteps = this.stepResults.filter(
        (step) => step.status === "failed",
      );
      const failedCommands = this.commandResults.filter(
        (command) => command.status === "failed",
      );

      const failureMessages = [];
      if (failedSteps.length > 0) {
        failureMessages.push(
          `Failed steps: ${failedSteps.map((s) => s.prompt).join(", ")}`,
        );
      }
      if (failedCommands.length > 0) {
        const failedAssertions = failedCommands.filter(
          (c) => c.command === "assert",
        );
        const otherFailedCommands = failedCommands.filter(
          (c) => c.command !== "assert",
        );

        if (failedAssertions.length > 0) {
          failureMessages.push(
            `Failed assertions: ${failedAssertions.map((c) => c.expect || "assertion").join(", ")}`,
          );
        }
        if (otherFailedCommands.length > 0) {
          failureMessages.push(
            `Failed commands: ${otherFailedCommands.map((c) => c.command).join(", ")}`,
          );
        }
      }

      const failureMessage =
        failureMessages.length > 0 ? failureMessages.join("; ") : "Test failed";
      this.currentTestCase.failure(failureMessage);
    }

    this.currentTest = null;
    this.currentTestCase = null;
  }

  handleStepStart() {
    // Step start is handled, the real work happens in handleStepEnd
  }

  handleStepEnd(data, status) {
    console.log(
      "[JUnit Reporter] handleStepEnd called with status:",
      status,
      "data:",
      data,
      "currentTest:",
      !!this.currentTest,
    );
    // Only record steps if we have an active test
    if (!this.currentTest) return;

    // Extract step info from data
    const prompt =
      data.prompt || `Step ${data.stepIndex || this.stepResults.length}`;

    // Record this step result
    this.stepResults.push({
      prompt: prompt,
      status: status,
      timestamp: data.timestamp,
    });
    console.log("[JUnit Reporter] Recorded step:", prompt, "status:", status);
  }

  handleCommandStart(data) {
    console.log("[JUnit Reporter] handleCommandStart called with:", data);
    // Commands are tracked but we wait for completion to record results
  }

  handleCommandEnd(data, status) {
    console.log(
      "[JUnit Reporter] handleCommandEnd called with status:",
      status,
      "data:",
      data,
      "currentTest:",
      !!this.currentTest,
    );
    // Only record commands if we have an active test
    if (!this.currentTest) return;

    // Extract command info from data
    const command = data.command || "unknown";
    const commandData = data.data || {};

    // Record this command result
    this.commandResults.push({
      command: command,
      status: status,
      timestamp: data.timestamp,
      expect: commandData.expect,
      description: commandData.description || commandData.code || "",
    });

    console.log(
      "[JUnit Reporter] Recorded command:",
      command,
      "status:",
      status,
    );
  }

  handleLogMessage(message) {
    console.log(
      "[JUnit Reporter] handleLogMessage called with:",
      message,
      "currentTest:",
      !!this.currentTest,
    );
    // Only collect log messages if we have an active test running
    if (!this.currentTest) return;

    // Collect ALL log:* events for system-out, stripping ANSI codes
    const cleanMessage = stripAnsi(message);
    this.systemOut.push(`${cleanMessage}`);
    console.log(
      "[JUnit Reporter] Added log to systemOut, total logs:",
      this.systemOut.length,
    );
  }

  handleErrorMessage(error) {
    console.log(
      "[JUnit Reporter] handleErrorMessage called with:",
      error,
      "currentTest:",
      !!this.currentTest,
    );
    // Only collect error messages if we have an active test running
    if (!this.currentTest) return;

    // Collect ALL error:* events for system-err, stripping ANSI codes
    const errorMessage =
      typeof error === "string" ? error : JSON.stringify(error);
    const cleanErrorMessage = stripAnsi(errorMessage);
    this.systemErr.push(`${cleanErrorMessage}`);
    console.log(
      "[JUnit Reporter] Added error to systemErr, total errors:",
      this.systemErr.length,
    );
  }

  getTestSuiteName(filePath) {
    // Extract folder path from testdriver root to file
    const relativePath = this.getRelativePathFromTestdriver(filePath);
    const folderPath = path.dirname(relativePath);

    // Create suite name from folder structure
    return folderPath === "." ? "testdriver" : `testdriver/${folderPath}`;
  }

  getRelativePathFromTestdriver(filePath) {
    // Find the "testdriver" directory in the path and return relative path from there
    const testdriverIndex = filePath.toLowerCase().indexOf("/testdriver/");
    if (testdriverIndex !== -1) {
      return filePath.substring(testdriverIndex + "/testdriver/".length);
    }

    // Fallback: use just the filename
    return path.basename(filePath);
  }

  finalizeReport() {
    console.log("[JUnit Reporter] Finalizing JUnit report...");

    // If we have a current test case that hasn't been finalized, finalize it now
    if (this.currentTest && this.currentTestCase) {
      console.log("[JUnit Reporter] Finalizing pending test case...");
      const duration = this.testStartTime
        ? (Date.now() - this.testStartTime) / 1000
        : 0;

      // Set test case duration
      this.currentTestCase.time(duration);

      // Add step results as properties
      this.stepResults.forEach((step, index) => {
        this.currentTestCase.property(
          `step${index + 1}[${step.status}]`,
          step.prompt,
        );
      });

      // Add system-out and system-err
      if (this.systemOut.length > 0) {
        console.log(
          "[JUnit Reporter] Adding system-out with",
          this.systemOut.length,
          "entries",
        );
        this.currentTestCase.standardOutput(this.systemOut.join("\n"));
      }
      if (this.systemErr.length > 0) {
        console.log(
          "[JUnit Reporter] Adding system-err with",
          this.systemErr.length,
          "entries",
        );
        this.currentTestCase.standardError(this.systemErr.join("\n"));
      }

      console.log(
        "[JUnit Reporter] Finalized pending test - Steps:",
        this.stepResults.length,
        "Commands:",
        this.commandResults.length,
        "Logs:",
        this.systemOut.length,
        "Errors:",
        this.systemErr.length,
      );
    }

    try {
      // Generate the XML report
      const xmlContent = builder.build();

      // Ensure output directory exists
      const outputDir = path.dirname(this.outputFilePath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Write to file
      fs.writeFileSync(this.outputFilePath, xmlContent);

      console.log(
        `[JUnit Reporter] JUnit report written to: ${this.outputFilePath}`,
      );
    } catch (error) {
      console.error("[JUnit Reporter] Failed to write JUnit report:", error);
    }
  }
}

/**
 * Factory function to create and initialize JUnit reporter
 */
function createJUnitReporter(emitter, outputFilePath, mainTestFile) {
  return new JUnitReporter(emitter, outputFilePath, mainTestFile);
}

module.exports = { JUnitReporter, createJUnitReporter };
