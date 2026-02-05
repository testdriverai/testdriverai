#!/usr/bin/env node

/**
 * Extract Example URLs from CI Logs
 * 
 * Parses vitest output to extract TESTDRIVER_EXAMPLE_URL lines
 * and updates the examples-manifest.json file.
 * 
 * Usage:
 *   cat ci-log.txt | node extract-example-urls.js
 *   node extract-example-urls.js < ci-log.txt
 *   node extract-example-urls.js --file=ci-log.txt
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const MANIFEST_PATH = path.join(__dirname, "../_data/examples-manifest.json");

// Regex to match TESTDRIVER_EXAMPLE_URL::filename::url (handles optional timestamp prefix from CI logs)
const URL_PATTERN = /TESTDRIVER_EXAMPLE_URL::([^:]+)::(.+)$/;

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    file: null,
    help: false,
  };

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg.startsWith("--file=")) {
      options.file = arg.slice(7);
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

// Process a single line and extract URL if present
function processLine(line, manifest, stats) {
  const match = line.match(URL_PATTERN);
  if (match) {
    const [, filename, url] = match;
    const isNew = !manifest.examples[filename];
    
    manifest.examples[filename] = {
      url: url.trim(),
      lastUpdated: new Date().toISOString(),
    };
    
    if (isNew) {
      stats.added++;
    } else {
      stats.updated++;
    }
    
    console.log(`${isNew ? "➕" : "🔄"} ${filename}: ${url}`);
  }
}

// Process input stream
async function processInput(inputStream) {
  const manifest = loadManifest();
  const stats = { added: 0, updated: 0 };

  const rl = readline.createInterface({
    input: inputStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    processLine(line, manifest, stats);
  }

  if (stats.added > 0 || stats.updated > 0) {
    saveManifest(manifest);
    console.log(`\n✨ Manifest updated: ${stats.added} added, ${stats.updated} updated`);
    console.log(`📂 Written to: ${MANIFEST_PATH}`);
  } else {
    console.log("\n⚠️  No TESTDRIVER_EXAMPLE_URL entries found in input");
  }

  return stats;
}

// Show help
function showHelp() {
  console.log(`
Extract Example URLs from CI Logs

Usage:
  cat ci-log.txt | node extract-example-urls.js
  node extract-example-urls.js < ci-log.txt
  node extract-example-urls.js --file=ci-log.txt

Options:
  --file=<path>   Read from file instead of stdin
  --help, -h      Show this help message

Description:
  Parses CI log output looking for lines matching:
    TESTDRIVER_EXAMPLE_URL::<filename>::<url>
  
  Updates docs/_data/examples-manifest.json with the extracted URLs.
  Existing entries are updated, new entries are added.
`);
}

// Main function
async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  console.log("🔍 Extracting example URLs from input...\n");

  let inputStream;
  if (options.file) {
    if (!fs.existsSync(options.file)) {
      console.error(`❌ File not found: ${options.file}`);
      process.exit(1);
    }
    inputStream = fs.createReadStream(options.file);
  } else {
    inputStream = process.stdin;
  }

  try {
    await processInput(inputStream);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
