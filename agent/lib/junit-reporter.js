const fs = require("fs");
const path = require("path");
const { events } = require("../events.js");
const builder = require("junit-report-builder");

/**
 * JUnit XML Reporter for TestDriver
 *
 * Subscribes to TestDriver events and generates JUnit XML reports
 * following the hierarchy:
 * - Root testsuite: folder path from "testdriver" to test file
 * - Nested testsuite: filename
 *   - Contains system-out from log:* events
 *   - Contains system-err from error:* events
 * - Nested testsuite: each step (prompt) within the file
 * - Testcase: each command within a step
 *   - Assertions are special testcases
 */
class JUnitReporter {
  constructor(emitter, outputFilePath) {
    this.emitter = emitter;
    this.outputFilePath = outputFilePath;

    // Current test hierarchy state
    this.currentTest = null;
    this.currentStep = null;
    this.currentCommand = null;

    // Track test suites and cases
    this.rootSuite = null;
    this.fileSuite = null;
    this.stepSuite = null;

    // Accumulate logs and errors for system-out/system-err
    this.systemOut = [];
    this.systemErr = [];

    // Track timing
    this.testStartTime = null;
    this.stepStartTime = null;
    this.commandStartTime = null;

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Test lifecycle events
    this.emitter.on(events.test.start, (data) => this.handleTestStart(data));
    this.emitter.on(events.test.success, (data) =>
      this.handleTestEnd(data, "passed"),
    );
    this.emitter.on(events.test.error, (data) =>
      this.handleTestEnd(data, "failed"),
    );

    // Step lifecycle events
    this.emitter.on(events.step.start, (data) => this.handleStepStart(data));
    this.emitter.on(events.step.success, (data) =>
      this.handleStepEnd(data, "passed"),
    );
    this.emitter.on(events.step.error, (data) =>
      this.handleStepEnd(data, "failed"),
    );

    // Command lifecycle events
    this.emitter.on(events.command.start, (data) =>
      this.handleCommandStart(data),
    );
    this.emitter.on(events.command.success, (data) =>
      this.handleCommandEnd(data, "passed"),
    );
    this.emitter.on(events.command.progress, (data) =>
      this.handleCommandProgress(data),
    );
    this.emitter.on(events.command.error, (data) =>
      this.handleCommandEnd(data, "failed"),
    );

    // Log and error events for system-out/system-err
    this.emitter.on("log:*", (message) => this.handleLogMessage(message));
    this.emitter.on("error:*", (error) => this.handleErrorMessage(error));

    // Handle exit to finalize report
    this.emitter.on(events.exit, () => this.finalizeReport());
  }

  handleTestStart(data) {
    const { filePath, timestamp } = data;
    this.currentTest = { filePath, timestamp };
    this.testStartTime = timestamp;

    // Reset logs for this test
    this.systemOut = [];
    this.systemErr = [];

    // Create root test suite based on folder structure
    this.createRootSuite(filePath);

    // Create file-level test suite
    this.createFileSuite(filePath);
  }

  handleTestEnd() {
    if (!this.fileSuite) return;

    // Add system-out and system-err to file suite
    if (this.systemOut.length > 0) {
      this.fileSuite.standardOutput(this.systemOut.join("\n"));
    }
    if (this.systemErr.length > 0) {
      this.fileSuite.standardError(this.systemErr.join("\n"));
    }

    this.currentTest = null;
  }

  handleStepStart(data) {
    const { stepIndex, prompt, timestamp } = data;
    this.currentStep = { stepIndex, prompt, timestamp };
    this.stepStartTime = timestamp;

    // Create step-level test suite under file suite
    if (this.fileSuite) {
      this.stepSuite = this.fileSuite
        .testSuite()
        .name(`Step ${stepIndex}: ${prompt}`);
    }
  }

  handleStepEnd(_data, status) {
    if (!this.stepSuite || !this.currentStep) return;

    // Add step properties
    this.stepSuite.property(`step[${status}]`, this.currentStep.prompt);

    this.currentStep = null;
    this.stepSuite = null;
  }

  handleCommandStart(data) {
    const { command, timestamp } = data;
    this.currentCommand = { command, timestamp, data };
    this.commandStartTime = timestamp;
  }

  handleCommandProgress(data) {
    // Some commands indicate completion via progress event with status="completed"
    if (data.status === "completed") {
      this.handleCommandEnd(data, "passed");
    }
  }

  handleCommandEnd(data, status) {
    if (!this.currentCommand || !this.stepSuite) return;

    const duration = this.commandStartTime
      ? data.timestamp - this.commandStartTime
      : 0;
    const commandName =
      this.currentCommand.data.command || this.currentCommand.command;

    // Create test case for this command
    const testCase = this.stepSuite
      .testCase()
      .className(`${this.currentTest?.filePath || "unknown"}`)
      .name(`${commandName}`)
      .time(duration / 1000); // Convert to seconds

    // Handle different command outcomes
    if (status === "failed") {
      const errorMessage =
        typeof data === "string"
          ? data
          : data.error || data.message || "Command failed";
      testCase.failure(errorMessage);
    } else if (status === "passed") {
      // Command passed - no additional action needed
    }

    // Special handling for assert commands
    if (commandName === "assert") {
      // Assert commands get special treatment as assertions
      const expectValue = this.currentCommand.data.data?.expect || "assertion";
      testCase.name(`assert: ${expectValue}`);

      if (status === "failed") {
        const errorMessage =
          typeof data === "string"
            ? data
            : data.error || data.message || "Assertion failed";
        testCase.failure(`Assertion failed: ${errorMessage}`);
      }
    }

    this.currentCommand = null;
  }

  handleLogMessage(message) {
    // Collect log messages for system-out
    const logLevel = this.emitter.event;
    this.systemOut.push(`[${logLevel}] ${message}`);
  }

  handleErrorMessage(error) {
    // Collect error messages for system-err
    const errorLevel = this.emitter.event;
    const errorMessage =
      typeof error === "string" ? error : JSON.stringify(error);
    this.systemErr.push(`[${errorLevel}] ${errorMessage}`);
  }

  createRootSuite(filePath) {
    // Extract folder path from testdriver root to file
    const relativePath = this.getRelativePathFromTestdriver(filePath);
    const folderPath = path.dirname(relativePath);

    // Create root suite name from folder structure
    const rootSuiteName =
      folderPath === "." ? "testdriver" : `testdriver/${folderPath}`;

    this.rootSuite = builder.testSuite().name(rootSuiteName);
  }

  createFileSuite(filePath) {
    if (!this.rootSuite) return;

    const fileName = path.basename(filePath);
    this.fileSuite = this.rootSuite.testSuite().name(fileName);
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

      console.log(`JUnit report written to: ${this.outputFilePath}`);
    } catch (error) {
      console.error("Failed to write JUnit report:", error);
    }
  }
}

/**
 * Factory function to create and initialize JUnit reporter
 */
function createJUnitReporter(emitter, outputFilePath) {
  return new JUnitReporter(emitter, outputFilePath);
}

module.exports = { JUnitReporter, createJUnitReporter };
