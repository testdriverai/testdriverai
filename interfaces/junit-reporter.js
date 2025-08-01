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

    // Track final test result based on exit code
    this.finalExitCode = null;

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
    // Test lifecycle events
    this.emitter.on(events.test.start, (data) => this.handleTestStart(data));

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
    this.emitter.on("log:*", (message) => this.handleLogMessage(message));
    this.emitter.on("error:*", (error) => this.handleErrorMessage(error));

    // Handle exit to finalize report
    this.emitter.on(events.exit, (exitCode) => this.finalizeReport(exitCode));
  }

  handleTestStart(data) {
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
  }

  handleStepStart() {
    // Step start is handled, the real work happens in handleStepEnd
  }

  handleStepEnd(data, status) {
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
  }

  handleCommandStart() {
    // Commands are tracked but we wait for completion to record results
  }

  handleCommandEnd(data, status) {
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
  }

  handleLogMessage(message) {
    // Only collect log messages if we have an active test running
    if (!this.currentTest) return;

    // Collect ALL log:* events for system-out, stripping ANSI codes
    const cleanMessage = stripAnsi(message);
    this.systemOut.push(`${cleanMessage}`);
  }

  handleErrorMessage(error) {
    // Only collect error messages if we have an active test running
    if (!this.currentTest) return;

    // Collect ALL error:* events for system-err, stripping ANSI codes
    const errorMessage =
      typeof error === "string" ? error : JSON.stringify(error);
    const cleanErrorMessage = stripAnsi(errorMessage);
    this.systemErr.push(`${cleanErrorMessage}`);
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

  finalizeReport(exitCode) {
    // Store the exit code for determining test status
    this.finalExitCode = exitCode;

    // If we have a current test case that hasn't been finalized, finalize it now
    if (this.currentTest && this.currentTestCase) {
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
        this.currentTestCase.standardOutput(this.systemOut.join("\n"));
      }
      if (this.systemErr.length > 0) {
        this.currentTestCase.standardError(this.systemErr.join("\n"));
      }

      // Determine test result based on exit code (0 = success, non-zero = failure)
      if (exitCode !== 0) {
        // Test failed - collect failure information from steps and commands for detailed message
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
          failureMessages.length > 0
            ? failureMessages.join("; ")
            : `Test failed with exit code ${exitCode}`;
        this.currentTestCase.failure(failureMessage);
      }
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
