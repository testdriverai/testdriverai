const SDK = require("./sdk.js");

const client = new SDK("test-key");

// Get all public methods (non-private, non-constructor)
const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(client))
  .filter((m) => !m.startsWith("_") && m !== "constructor")
  .sort();

console.log("Public SDK Methods:");
console.log(methods.join(", "));
console.log("\nTotal:", methods.length, "methods");

// Check if commands will be set up after connect
console.log("\nCommands before connect:", client.commands);
