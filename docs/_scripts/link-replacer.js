#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

/**
 * Script to replace command references in Mintlify docs with proper links
 *
 * This script finds instances of command names like `hover-text`, `wait-for-text`, etc.
 * and replaces them with proper Mintlify links to their documentation pages.
 */

// Get all command files from the commands directory
function getCommandNames() {
  const commandsDir = path.join(__dirname, "../", "commands");

  if (!fs.existsSync(commandsDir)) {
    console.error("Commands directory not found:", commandsDir);
    process.exit(1);
  }

  const files = fs.readdirSync(commandsDir);
  const commands = files
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => file.replace(".mdx", ""));

  console.log("Found commands:", commands);
  return commands;
}

// Process a single file
function processFile(filePath, commands) {
  const content = fs.readFileSync(filePath, "utf-8");
  let modified = content;
  let changes = 0;

  commands.forEach((command) => {
    // Create regex pattern to match `command-name` but not already linked commands
    // This pattern looks for backtick-wrapped command names that are NOT:
    // 1. Already inside a link: [` or preceded by ]( or ](/
    // 2. Part of an existing link structure
    const pattern = new RegExp(
      `(?<!\\[)\`(${command.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")})\`(?!\\]\\(|\\)\\]|\\]\\(/commands/)`,
      "g",
    );

    const replacement = `[\`$1\`](/commands/$1)`;
    const newContent = modified.replace(pattern, replacement);

    if (newContent !== modified) {
      const matchCount = (modified.match(pattern) || []).length;
      console.log(`  - Replaced ${matchCount} instances of \`${command}\``);
      changes += matchCount;
      modified = newContent;
    }
  });

  return { content: modified, changes };
}

// Process all .mdx files in a directory recursively
function processDirectory(dirPath, commands, exclude = []) {
  const items = fs.readdirSync(dirPath);
  let totalChanges = 0;

  items.forEach((item) => {
    const itemPath = path.join(dirPath, item);
    const relativePath = path.relative(process.cwd(), itemPath);

    // Skip excluded directories
    if (exclude.some((ex) => relativePath.includes(ex))) {
      return;
    }

    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      totalChanges += processDirectory(itemPath, commands, exclude);
    } else if (item.endsWith(".mdx")) {
      console.log(`Processing: ${relativePath}`);
      const result = processFile(itemPath, commands);

      if (result.changes > 0) {
        fs.writeFileSync(itemPath, result.content, "utf-8");
        console.log(`  ✅ Updated with ${result.changes} changes`);
        totalChanges += result.changes;
      } else {
        console.log(`  ⏭️  No changes needed`);
      }
    }
  });

  return totalChanges;
}

// Main function
function main() {
  console.log("🚀 Starting TestDriver AI docs link replacer...\n");

  // Get command names from the commands directory
  const commands = getCommandNames();

  if (commands.length === 0) {
    console.log("No commands found. Exiting.");
    return;
  }

  console.log(`\n📝 Processing documentation files...\n`);

  // Process all .mdx files in the docs directory, excluding the commands directory itself
  const docsDir = path.join(__dirname, "../");
  const exclude = ["commands"]; // Don't modify the command docs themselves

  const totalChanges = processDirectory(docsDir, commands, exclude);

  console.log(`\n✨ Complete! Made ${totalChanges} total replacements.`);

  if (totalChanges > 0) {
    console.log("\n📋 Summary:");
    console.log(
      "- Command references like `hover-text` have been replaced with [`hover-text`](/commands/hover-text)",
    );
    console.log("- Only changed files that needed updates");
    console.log(
      "- Excluded the /commands directory to avoid self-referencing issues",
    );
    console.log("\nYou may want to review the changes before committing.");
  } else {
    console.log("\n🎉 All files are already properly linked!");
  }
}

// Handle command line arguments
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
TestDriver AI Documentation Link Replacer

Usage: node link-replacer.js [options]

Options:
  --help, -h    Show this help message
  --dry-run     Show what would be changed without making actual changes (TODO)

Description:
  This script finds command references like \`hover-text\` in your Mintlify 
  documentation and replaces them with proper links to the command reference
  pages like [\`hover-text\`](/commands/hover-text).

  The script:
  - Scans all .mdx files in the /docs directory
  - Excludes the /commands directory to avoid self-references  
  - Only replaces \`command-name\` patterns that aren't already linked
  - Preserves existing links and formatting
`);
  process.exit(0);
}

// Run the script
try {
  main();
} catch (error) {
  console.error("❌ Error:", error.message);
  process.exit(1);
}
