#!/usr/bin/env node

// Test script to verify JUnit reporter handles failures correctly
const { events, createEmitter } = require("./agent/events");
const { createJUnitReporter } = require("./interfaces/junit");

console.log("Testing JUnit Reporter with failures...");

// Create a test emitter
const emitter = createEmitter();

// Create JUnit reporter with test options
createJUnitReporter(emitter, {
  outputPath: "./test-results-failure.xml",
  suiteName: "TestDriver Failure Test",
});

// Simulate a test execution flow with failures
console.log("Simulating failed test execution...");

// Start a test file
emitter.emit(events.file.start, { file: "testdriver/failure-example.yaml" });

// Simulate some commands
emitter.emit(events.command.start, {
  command: "assert",
  args: ["page loaded"],
});
emitter.emit(events.log.log, "Checking if page is loaded...");
emitter.emit(events.command.success, { command: "assert" });

emitter.emit(events.command.start, { command: "type", args: ["hello world"] });
emitter.emit(events.log.log, "Trying to type text into field...");
emitter.emit(events.command.error, "Element not found: input field");

emitter.emit(events.step.error, "Step failed due to missing element");
emitter.emit(events.error.general, "Test execution failed");

// Complete the test with failure
emitter.emit(events.file.stop);

// Simulate exit with error code
emitter.emit(events.exit, 1);

console.log(
  "Failure test simulation completed. Check test-results-failure.xml for output.",
);
