const builder = require("junit-report-builder");
const fs = require("fs");
const path = require("path");
const { events } = require("../agent/events");
const Convert = require("ansi-to-html");

/**
 * JUnit Reporter - Creates JUnit XML test reports from TestDriver events
 *
 * This interface hooks into the TestDriver CLI execution and tracks test state
 * through events, similar to how the VS Code extension works. It listens to
 * various TestDriver events to build a comprehensive test report in JUnit XML format.
 *
 * Usage:
 *   // In CLI
 *   testdriverai run test.yaml --junit=test-results.xml
 *
 *   // Programmatically
 *   const { createJUnitReporter } = require('./interfaces/junit');
 *   const reporter = createJUnitReporter(emitter, {
 *     outputPath: 'test-results.xml',
 *     suiteName: 'My Test Suite'
 *   });
 *
 * Features:
 * - Tracks test execution timing
 * - Captures command and step failures
 * - Includes detailed output logs
 * - Handles both single tests and test suites
 * - Compatible with CI/CD systems that consume JUnit XML
 */
class JUnitReporter {
  constructor() {
    this.rootTestSuite = null;
    this.currentFileTestSuite = null;
    this.currentTest = null;
    this.testStartTime = null;
    this.commandStartTime = null;
    this.currentStepErrors = [];
    this.currentCommandErrors = [];
    this.outputBuffer = [];
    this.testFile = null;
    this.currentFileName = null;
    this.currentStep = null;
    this.currentCommand = null;
    this.suiteName = "TestDriver";

    // Initialize ANSI to HTML converter
    this.ansiConverter = new Convert({
      fg: "#000000",
      bg: "#ffffff",
      newline: true,
      escapeXML: true,
      stream: false,
    });
  }

  /**
   * Format output for HTML display by converting ANSI codes and formatting JSON
   * @param {string} output - Raw output string
   * @returns {string} Formatted output
   */
  formatOutput(output) {
    if (!output || typeof output !== "string") {
      return output;
    }

    // First, check if the entire output looks like JSON
    if (output.trim().startsWith("{") && output.trim().endsWith("}")) {
      try {
        const parsed = JSON.parse(output.trim());
        const formatted = JSON.stringify(parsed, null, 2);
        return `<pre>${this.ansiConverter.toHtml(formatted)}</pre>`;
      } catch {
        // If it's not valid JSON, continue with normal processing
      }
    }

    // Convert ANSI codes to HTML
    let formatted = this.ansiConverter.toHtml(output);

    // Look for embedded JSON objects and format them
    try {
      formatted = formatted.replace(
        /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g,
        (match) => {
          try {
            // Decode HTML entities first
            const decoded = match
              .replace(/&quot;/g, '"')
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&amp;/g, "&");
            const parsed = JSON.parse(decoded);
            const prettyJson = JSON.stringify(parsed, null, 2);
            return `<pre>${this.ansiConverter.toHtml(prettyJson)}</pre>`;
          } catch {
            return match;
          }
        },
      );
    } catch {
      // If JSON parsing fails, just return the ANSI-converted version
    }

    return formatted;
  }

  /**
   * Format error messages for better HTML display
   * @param {any} error - Error object or string
   * @returns {string} Formatted error message
   */
  formatError(error) {
    if (typeof error === "string") {
      return this.formatOutput(error);
    } else if (typeof error === "object") {
      const formatted = JSON.stringify(error, null, 2);
      return `<pre>${this.ansiConverter.toHtml(formatted)}</pre>`;
    }
    return String(error);
  }

  /**
   * Initialize the JUnit reporter with an event emitter
   * @param {EventEmitter2} emitter - The TestDriver agent event emitter
   * @param {Object} options - Configuration options
   */
  init(emitter, options = {}) {
    this.outputPath = options.outputPath || "test-results.xml";
    this.suiteName = options.suiteName || "TestDriver";

    this.setupEventListeners(emitter);
  }

  /**
   * Set up event listeners to track test execution state
   * @param {EventEmitter2} emitter - The TestDriver agent event emitter
   */
  setupEventListeners(emitter) {
    // Track test execution start and end (file level)
    emitter.on(events.test.start, (data) => {
      this.handleTestStart(data);
    });

    emitter.on(events.test.stop, (data) => {
      this.handleTestEnd(data);
    });

    emitter.on(events.test.success, (data) => {
      this.handleTestSuccess(data);
    });

    emitter.on(events.test.error, (data) => {
      this.handleTestError(data);
    });

    // Track step execution (step level)
    emitter.on(events.step.start, (data) => {
      this.handleStepStart(data);
    });

    emitter.on(events.step.success, (data) => {
      this.handleStepSuccess(data);
    });

    emitter.on(events.step.error, (data) => {
      this.handleStepError(data);
    });

    // Track command execution (command level)
    emitter.on(events.command.start, (data) => {
      this.handleCommandStart(data);
    });

    emitter.on(events.command.success, (data) => {
      this.handleCommandSuccess(data);
    });

    emitter.on(events.command.error, (data) => {
      this.handleCommandError(data);
    });

    // Track general errors
    emitter.on(events.error.general, (data) => {
      this.handleError(data);
    });

    emitter.on(events.error.fatal, (data) => {
      this.handleFatalError(data);
    });

    // Track log output
    emitter.on(events.log.log, (data) => {
      this.handleLogOutput(data);
    });

    emitter.on(events.log.warn, (data) => {
      this.handleLogOutput(data, "warn");
    });

    // Track test exit
    emitter.on(events.exit, (exitCode) => {
      this.handleExit(exitCode);
    });
  }

  /**
   * Handle test execution start
   * @param {Object} data - Event data containing filePath and timestamp
   */
  handleTestStart(data) {
    const fileName = data?.filePath || this.testFile || "Unknown Test";
    this.testFile = fileName;

    // Store the current file name for use in test case names
    this.currentFileName = path.basename(fileName, path.extname(fileName));

    // Create a separate test suite for this file - following the guide where steps become a series of method calls inside a @Test
    this.currentFileTestSuite = builder.testSuite().name(this.currentFileName);

    this.testStartTime = data?.timestamp || Date.now();
    this.currentStepErrors = [];
    this.currentCommandErrors = [];
    this.outputBuffer = [];

    console.log(`JUnit: Starting test file ${this.currentFileName}`);
  }

  /**
   * Handle test execution completion
   * @param {Object} data - Event data containing success status, duration, etc.
   */
  handleTestEnd(data) {
    // Complete any remaining command test case
    this.completeCurrentCommand();

    const duration = data?.duration
      ? data.duration / 1000
      : this.testStartTime
        ? (Date.now() - this.testStartTime) / 1000
        : 0;

    const testFailed =
      data?.success === false ||
      data?.error ||
      this.currentStepErrors.length > 0;

    const testName = this.currentFileName || "Unknown Test";
    const status = testFailed ? "FAILED" : "PASSED";
    console.log(
      `JUnit: Test file ${testName} completed - ${status} (${duration.toFixed(3)}s)`,
    );

    // Reset current test state
    this.testStartTime = null;
    this.currentStepErrors = [];
    this.currentStep = null;
    this.currentFileName = null;
  }

  /**
   * Handle test success
   * @param {Object} data - Event data
   */
  handleTestSuccess(data) {
    // Additional handling for test success if needed
    const successInfo =
      typeof data === "string" ? data : JSON.stringify(data, null, 2);
    this.outputBuffer.push(`Test completed successfully: ${successInfo}`);
  }

  /**
   * Handle test error
   * @param {Object} data - Event data
   */
  handleTestError(data) {
    const errorInfo =
      typeof data === "string"
        ? data
        : data?.error || JSON.stringify(data, null, 2);
    this.currentStepErrors.push(errorInfo);
    this.outputBuffer.push(`Test failed: ${errorInfo}`);
  }

  /**
   * Handle command start - Commands become method calls within the @Test step
   * @param {Object} data - Event data
   */
  handleCommandStart(data) {
    const commandInfo =
      typeof data === "string"
        ? data
        : data?.command || JSON.stringify(data, null, 2);

    // Following the mapping guide:
    // - command: run with file → Method call or helper class invocation
    // - command: focus-application → Setup step or precondition in test
    // - command: hover-image → UI interaction via framework (e.g., Selenium)
    // - command: assert → assertEquals, assertTrue, etc.
    
    let commandDescription = commandInfo;
    if (typeof data === 'object' && data?.command) {
      switch (data.command) {
        case 'run':
          commandDescription = `Method call: run(${data.file || 'file'})`;
          break;
        case 'focus-application':
          commandDescription = `Setup: focusApplication("${data.name || 'application'}")`;
          break;
        case 'hover-image':
          commandDescription = `UI interaction: hoverImage("${data.description || 'element'}")`;
          break;
        case 'hover-text':
          commandDescription = `UI interaction: hoverText("${data.text || 'text'}")`;
          break;
        case 'click':
          commandDescription = `UI interaction: click(${data.x || 0}, ${data.y || 0})`;
          break;
        case 'type':
          commandDescription = `UI interaction: type("${data.text || ''}")`;
          break;
        case 'assert':
          commandDescription = `Assertion: expect("${data.expect || 'condition'}")`;
          break;
        case 'exec':
          commandDescription = `Execute: ${data.lang || 'code'}("${(data.code || '').substring(0, 50)}...")`;
          break;
        default:
          commandDescription = `Command: ${data.command}`;
      }
    }

    this.commandStartTime = Date.now();
    // Add command execution to the step's output (commands are method calls within the @Test)
    this.outputBuffer.push(`> ${commandDescription}`);
    console.log(`JUnit: Executing command (method call) - ${commandDescription}`);
  }

  /**
   * Strip ANSI escape codes from text for plain text output
   * @param {string} text - Text with ANSI codes
   * @returns {string} Plain text without ANSI codes
   */
  stripAnsi(text) {
    if (!text || typeof text !== "string") {
      return text;
    }
    // Remove ANSI escape sequences - using more comprehensive regex
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
  }

  /**
   * Handle command success - Log the successful method call within the step
   * @param {Object} data - Event data
   */
  handleCommandSuccess(data) {
    const commandInfo =
      typeof data === "string" ? data : JSON.stringify(data, null, 2);
    this.outputBuffer.push(`✓ Command succeeded: ${commandInfo}`);
    
    const duration = this.commandStartTime
      ? (Date.now() - this.commandStartTime) / 1000
      : 0;
    this.outputBuffer.push(`  Duration: ${duration.toFixed(3)}s`);
  }

  /**
   * Handle command error - Log the failed method call within the step
   * @param {Object} data - Event data
   */
  handleCommandError(data) {
    this.currentCommandErrors.push(data);
    const errorInfo =
      typeof data === "string" ? data : JSON.stringify(data, null, 2);
    this.outputBuffer.push(`✗ Command failed: ${errorInfo}`);
    
    const duration = this.commandStartTime
      ? (Date.now() - this.commandStartTime) / 1000
      : 0;
    this.outputBuffer.push(`  Duration: ${duration.toFixed(3)}s`);
  }

  /**
   * Handle step start - Each step becomes a @Test method containing series of commands
   * @param {Object} data - Event data
   */
  handleStepStart(data) {
    // Complete any previous step test case first
    this.completeCurrentStep();

    if (!this.currentFileTestSuite) {
      console.warn("JUnit: Step started without active test suite");
      return;
    }

    const stepInfo =
      typeof data === "string"
        ? data
        : data?.prompt || data?.command || JSON.stringify(data, null, 2);

    // Each step becomes a @Test method - following the mapping guide
    // prompt → Comment or log for test readability, so we use it as the test name
    this.currentTest = this.currentFileTestSuite
      .testCase()
      .className(this.currentFileName)
      .name(stepInfo || "Step");

    this.stepStartTime = Date.now();
    this.currentStep = stepInfo;
    this.outputBuffer = [`Test step started: ${stepInfo}`];
    this.currentCommandErrors = [];

    console.log(`JUnit: Starting step (test method) - ${stepInfo}`);
  }

  /**
   * Complete the current step test case
   */
  completeCurrentStep() {
    if (this.currentTest) {
      const duration = this.stepStartTime
        ? (Date.now() - this.stepStartTime) / 1000
        : 0;
      this.currentTest.time(duration);

      // Add all accumulated output from this step
      if (this.outputBuffer.length > 0) {
        // For system-out: strip ANSI codes for plain text
        const plainTextOutput = this.outputBuffer
          .map((output) => this.stripAnsi(output))
          .join("\n");
        this.currentTest.standardOutput(plainTextOutput);

        // For rich HTML property: format with ANSI-to-HTML conversion
        const formattedOutput = this.outputBuffer
          .map((output) => this.formatOutput(output))
          .join("\n");
        const htmlContent = `
        <h3>Test Step Output</h3>
        <div style="font-family: monospace; background: #f5f5f5; padding: 10px; border-radius: 4px;">
          ${formattedOutput}
        </div>`;
        
        this.currentTest.property("html:richtext", htmlContent);
      }

      // If there were any errors in this step, mark as failed
      if (this.currentCommandErrors.length > 0) {
        const errorMessage = this.currentCommandErrors
          .map((err) => this.formatError(err))
          .join("\n");
        this.currentTest.failure(errorMessage);
      }

      this.currentTest = null;
      this.currentCommandErrors = [];
    }
  }

  /**
   * Handle step success
   * @param {Object} data - Event data
   */
  handleStepSuccess(data) {
    const stepInfo =
      typeof data === "string" ? data : JSON.stringify(data, null, 2);
    this.outputBuffer.push(`Step succeeded: ${stepInfo}`);
  }

  /**
   * Handle step error
   * @param {Object} data - Event data
   */
  handleStepError(data) {
    this.currentStepErrors.push(data);
    const errorInfo =
      typeof data === "string" ? data : JSON.stringify(data, null, 2);
    this.outputBuffer.push(`Step failed: ${errorInfo}`);

    // If we have a current test, mark it as failed
    if (this.currentTest) {
      this.currentTest.failure(this.formatError(data));
    }
  }

  /**
   * Handle general errors
   * @param {Object} data - Event data
   */
  handleError(data) {
    this.currentStepErrors.push(data);
    const errorInfo =
      typeof data === "string" ? data : JSON.stringify(data, null, 2);
    this.outputBuffer.push(`Error: ${errorInfo}`);
  }

  /**
   * Handle fatal errors
   * @param {Object} data - Event data
   */
  handleFatalError(data) {
    this.currentStepErrors.push(data);
    const errorInfo =
      typeof data === "string" ? data : JSON.stringify(data, null, 2);
    this.outputBuffer.push(`Fatal Error: ${errorInfo}`);

    // If we have a current test, mark it as failed immediately
    if (this.currentTest) {
      this.currentTest.failure(this.formatError(data));
    }

    // Complete the test with failure
    this.handleTestEnd({
      success: false,
      error: errorInfo,
    });
  }

  /**
   * Handle log output
   * @param {string} data - Log message
   * @param {string} level - Log level (optional)
   */
  handleLogOutput(data, level = "info") {
    if (typeof data === "string") {
      const logMessage = `[${level}] ${data}`;
      // Always add to the output buffer - it will be included in the next command's output
      this.outputBuffer.push(logMessage);
    }
  }

  /**
   * Handle test exit
   * @param {number} exitCode - Process exit code
   */
  handleExit(exitCode) {
    // Complete any remaining command test case
    this.completeCurrentCommand();

    // If exit code is non-zero and we still have active state, consider it a failure
    const testFailed = exitCode !== 0;
    if (testFailed && this.testStartTime) {
      this.currentStepErrors.push(`Process exited with code ${exitCode}`);
      this.handleTestEnd({
        success: false,
        error: `Process exited with code ${exitCode}`,
      });
    }

    // Write the final report
    this.writeReport();
  }

  /**
   * Write the JUnit XML report to file
   */
  writeReport() {
    try {
      // Ensure output directory exists
      const outputDir = path.dirname(this.outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Write the XML report (builder automatically includes all test suites)
      const xmlContent = builder.build();
      fs.writeFileSync(this.outputPath, xmlContent);

      console.log(`JUnit: Report written to ${this.outputPath}`);
    } catch (error) {
      console.error("JUnit: Failed to write report:", error);
    }
  }

  /**
   * Create a standalone test result (for cases where file events aren't fired)
   * This is useful for programmatic test result creation or when integrating
   * with other testing frameworks.
   *
   * @param {string} testName - Name of the test
   * @param {boolean} passed - Whether the test passed
   * @param {number} duration - Test duration in seconds
   * @param {string} errorMessage - Error message if test failed
   * @param {string} output - Test output
   * @returns {Object} Test case object
   */
  createStandaloneTest(
    testName,
    passed,
    duration = 0,
    errorMessage = null,
    output = "",
  ) {
    // Create a standalone test suite
    const testSuite = builder.testSuite().name("Standalone Tests");

    const testCase = testSuite
      .testCase()
      .className("Standalone")
      .name(testName)
      .time(duration);

    if (output) {
      testCase.standardOutput(output);
    }

    if (!passed && errorMessage) {
      testCase.failure(errorMessage);
    }

    return testCase;
  }
}

/**
 * Factory function to create and initialize a JUnit reporter
 * @param {EventEmitter2} emitter - The TestDriver agent event emitter
 * @param {Object} options - Configuration options
 * @returns {JUnitReporter} Initialized JUnit reporter instance
 */
const createJUnitReporter = (emitter, options = {}) => {
  const reporter = new JUnitReporter();
  reporter.init(emitter, options);
  return reporter;
};

module.exports = {
  JUnitReporter,
  createJUnitReporter,
};
