#!/usr/bin/env node

// Test script to verify that TestDriverAI can be used as a module
// with configurable default test file paths

const TestDriverAgent = require("./agent");

console.log("Testing TestDriverAI module usage with custom paths...\n");

// Test 1: Using default path from config
console.log("Test 1: Using default path from config");
const agent1 = new TestDriverAgent();
console.log(`Default thisFile: ${agent1.thisFile}`);
console.log(
  `Config TD_DEFAULT_TEST_FILE: ${agent1.config.TD_DEFAULT_TEST_FILE}\n`,
);

// Test 2: Using custom path via environment variable
console.log("Test 2: Using custom path via environment variable");
const agent2 = new TestDriverAgent({
  TD_DEFAULT_TEST_FILE: "custom/path/my-test.yaml",
});
console.log(`Custom thisFile: ${agent2.thisFile}`);
console.log(
  `Config TD_DEFAULT_TEST_FILE: ${agent2.config.TD_DEFAULT_TEST_FILE}\n`,
);

// Test 3: Using explicit file path via cliArgs
console.log("Test 3: Using explicit file path via cliArgs");
const agent3 = new TestDriverAgent({}, { args: ["explicit/test.yaml"] });
console.log(`Explicit thisFile: ${agent3.thisFile}\n`);

// Test 4: Using custom working directory
console.log("Test 4: Using custom working directory");
const agent4 = new TestDriverAgent(
  { TD_DEFAULT_TEST_FILE: "tests/main.yaml" },
  { options: { workingDir: "/tmp/my-project" } },
);
console.log(`Custom workingDir thisFile: ${agent4.thisFile}\n`);

console.log("All tests completed!");
