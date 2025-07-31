#!/usr/bin/env node

// Test script to verify ANSI and JSON formatting in JUnit reporter
const { events, createEmitter } = require("./agent/events");
const { createJUnitReporter } = require("./interfaces/junit");

console.log("Testing JUnit Reporter with ANSI and JSON formatting...");

// Create a test emitter
const emitter = createEmitter();

// Create JUnit reporter with test options
createJUnitReporter(emitter, {
  outputPath: "./test-results-formatted.xml",
  suiteName: "TestDriver Formatting Test",
});

// Simulate a test execution with ANSI codes and JSON
console.log("Simulating test with ANSI codes and JSON objects...");

// Start a test
emitter.emit(events.test.start, {
  filePath: "testdriver/formatting-example.yaml",
  timestamp: Date.now(),
});

// Simulate log output with ANSI codes (colors)
emitter.emit(events.log.log, "\x1b[32mThis is green text\x1b[0m");
emitter.emit(events.log.log, "\x1b[31mThis is red text\x1b[0m");
emitter.emit(events.log.log, "\x1b[1mThis is bold text\x1b[0m");

// Simulate commands with JSON data
emitter.emit(events.command.start, {
  command: "assert",
  args: ["page loaded"],
  timestamp: Date.now(),
  metadata: { selector: "#main-content", timeout: 5000 },
});

emitter.emit(events.log.log, "Checking if page is loaded...");
emitter.emit(events.command.success, {
  command: "assert",
  result: true,
  timing: { start: 1000, end: 1200, duration: 200 },
});

// Simulate step with complex JSON
emitter.emit(events.step.start, {
  stepIndex: 0,
  prompt: "Load the page",
  config: {
    browser: "chrome",
    viewport: { width: 1280, height: 720 },
    options: ["--headless", "--no-sandbox"],
  },
});

emitter.emit(
  events.log.log,
  "\x1b[36mLoading page with configuration...\x1b[0m",
);
emitter.emit(events.step.success, {
  stepIndex: 0,
  result: {
    success: true,
    pageTitle: "Test Application",
    loadTime: 1250,
    resources: {
      scripts: 15,
      stylesheets: 8,
      images: 22,
    },
  },
});

// Complete the test successfully
emitter.emit(events.test.success, {
  filePath: "testdriver/formatting-example.yaml",
  duration: 3000,
  summary: {
    stepsExecuted: 1,
    commandsExecuted: 1,
    totalTime: 3.0,
    status: "passed",
  },
  timestamp: Date.now(),
});

emitter.emit(events.test.stop, {
  filePath: "testdriver/formatting-example.yaml",
  duration: 3000,
  success: true,
  timestamp: Date.now(),
});

// Simulate exit
emitter.emit(events.exit, 0);

console.log(
  "Test simulation completed. Check test-results-formatted.xml for output.",
);
