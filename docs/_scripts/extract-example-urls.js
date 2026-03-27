#!/usr/bin/env node

/**
 * Extract Example URLs from Test Result JSON Files
 *
 * Reads per-test-case JSON result files written by the vitest plugin
 * to .testdriver/results/ and updates examples-manifest.json.
 *
 * Usage:
 *   node extract-example-urls.js --results-dir=.testdriver/results
 */

const fs = require("fs");
const path = require("path");

const MANIFEST_PATH = path.join(__dirname, "../_data/examples-manifest.json");

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    resultsDir: null,
    help: false,
  };

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg.startsWith("--results-dir=")) {
      options.resultsDir = arg.slice(14);
    }
  }

  return options;
}

// Load existing manifest or create new one
function loadManifest() {
  try {
    const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    return {
      "$schema": "./examples-manifest.schema.json",
      "examples": {},
    };
  }
}

// Save manifest
function saveManifest(manifest) {
  const dir = path.dirname(MANIFEST_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
}

// Process JSON result files from .testdriver/results/
function processResultsDir(resultsDir) {
  const manifest = loadManifest();
  const stats = { added: 0, updated: 0 };

  // Look for JSON files under examples/ subdirectories
  const examplesDir = path.join(resultsDir, "examples");
  if (!fs.existsSync(examplesDir)) {
    console.log(`\n⚠️  No examples results found in ${examplesDir}`);
    return stats;
  }

  // Walk example test directories (e.g., examples/assert.test.mjs/)
  const testDirs = fs.readdirSync(examplesDir, { withFileTypes: true });
  for (const entry of testDirs) {
    if (!entry.isDirectory()) continue;
    const testDir = path.join(examplesDir, entry.name);
    const jsonFiles = fs.readdirSync(testDir).filter(f => f.endsWith(".json"));

    for (const jsonFile of jsonFiles) {
      try {
        const content = fs.readFileSync(path.join(testDir, jsonFile), "utf-8");
        const result = JSON.parse(content);
        const testFileName = path.basename(result.test?.file || result.testFile || entry.name);
        const url = result.urls?.testRun || result.testRunLink;

        if (!url) continue;

        const isNew = !manifest.examples[testFileName];
        manifest.examples[testFileName] = {
          url: url,
          lastUpdated: result.date || new Date().toISOString(),
        };

        if (isNew) {
          stats.added++;
        } else {
          stats.updated++;
        }

        console.log(`${isNew ? "➕" : "🔄"} ${testFileName}: ${url}`);
      } catch (err) {
        console.warn(`⚠️  Failed to read ${jsonFile}: ${err.message}`);
      }
    }
  }

  if (stats.added > 0 || stats.updated > 0) {
    saveManifest(manifest);
    console.log(`\n✨ Manifest updated: ${stats.added} added, ${stats.updated} updated`);
    console.log(`📂 Written to: ${MANIFEST_PATH}`);
  } else {
    console.log("\n⚠️  No example URLs found in result files");
  }

  return stats;
}

// Show help
function showHelp() {
  console.log(`
Extract Example URLs from Test Result JSON Files

Usage:
  node extract-example-urls.js --results-dir=.testdriver/results

Options:
  --results-dir=<path>  Path to .testdriver/results directory (required)
  --help, -h            Show this help message

Description:
  Reads per-test-case JSON result files from .testdriver/results/examples/
  and updates docs/_data/examples-manifest.json with the extracted URLs.
  Existing entries are updated, new entries are added.
`);
}

// Main function
function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (!options.resultsDir) {
    console.error("❌ --results-dir is required. Example: --results-dir=.testdriver/results");
    process.exit(1);
  }

  console.log("🔍 Reading example URLs from JSON result files...\n");

  if (!fs.existsSync(options.resultsDir)) {
    console.error(`❌ Results directory not found: ${options.resultsDir}`);
    process.exit(1);
  }

  processResultsDir(options.resultsDir);
}

main();
