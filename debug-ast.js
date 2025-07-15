#!/usr/bin/env node

const yamlAst = require("@stoplight/yaml-ast-parser");
const yaml = require("js-yaml");
const fs = require("fs");

function debugAST() {
  const testFile =
    "/Users/ianjennings/Development/testdriverai/test-source-mapping.yaml";
  const yamlContent = fs.readFileSync(testFile, "utf-8");

  console.log("YAML Content:");
  console.log(yamlContent);
  console.log("\n" + "=".repeat(50) + "\n");

  const ast = yamlAst.load(yamlContent);

  console.log("AST Structure:");
  console.log(
    JSON.stringify(
      ast,
      (key, value) => {
        if (key === "parent") return "[parent]"; // Avoid circular reference
        return value;
      },
      2,
    ),
  );

  console.log("\n" + "=".repeat(50) + "\n");

  // Test with js-yaml for comparison
  const yamlObj = yaml.load(yamlContent);
  console.log("js-yaml result:");
  console.log(JSON.stringify(yamlObj, null, 2));
}

debugAST();
