#!/usr/bin/env node

// Simple test script to verify JUnit reporter functionality
const { events, createEmitter } = require("./agent/events");
const { createJUnitReporter } = require("./interfaces/junit");

console.log("Testing JUnit Reporter...");

// Create a test emitter
const emitter = createEmitter();

// Create JUnit reporter with test options
createJUnitReporter(emitter, {
  outputPath: "./test-results.xml",
  suiteName: "TestDriver Test Suite",
});

// Simulate a test execution flow
console.log("Simulating test execution...");

// Start a test file
emitter.emit(events.file.start, { file: "testdriver/example.yaml" });

// Simulate some commands
emitter.emit(events.command.start, {
  command: "assert",
  args: ["page loaded"],
});
emitter.emit(events.log.log, "Checking if page is loaded...");
emitter.emit(events.command.success, { command: "assert" });

emitter.emit(events.command.start, { command: "type", args: ["hello world"] });
emitter.emit(events.log.log, "Typing text into field...");
emitter.emit(events.command.success, { command: "type" });

// Complete the test successfully
emitter.emit(events.file.stop);

// Simulate exit
emitter.emit(events.exit, 0);

console.log("Test simulation completed. Check test-results.xml for output.");
