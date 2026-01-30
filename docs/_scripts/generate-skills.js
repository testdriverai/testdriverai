#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

/**
 * Script to generate MCP skills from docs/v7/*.mdx files
 *
 * This script reads the frontmatter from each mdx file and generates
 * SKILL.md files in the skills/ output directory.
 */

const DOCS_DIR = path.join(__dirname, "../v7");
const OUTPUT_DIR = path.join(__dirname, "../../skills");

// Parse YAML frontmatter from mdx content
function parseFrontmatter(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterText = frontmatterMatch[1];
  const body = content.slice(frontmatterMatch[0].length).trim();

  // Simple YAML parser for our use case
  const frontmatter = {};
  const lines = frontmatterText.split("\n");
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*"?([^"]*)"?\s*$/);
    if (match) {
      frontmatter[match[1]] = match[2];
    }
  }

  return { frontmatter, body };
}

// Get skill name from filename
function getSkillName(filename) {
  return `testdriver:${filename.replace(".mdx", "")}`;
}

// Generate SKILL.md content
function generateSkillContent(filename, frontmatter, body) {
  const skillName = getSkillName(filename);
  const description = frontmatter.description || frontmatter.sidebarTitle || filename.replace(".mdx", "");
  
  return `---
name: ${skillName}
description: ${description}
---
<!-- Generated from ${filename}. DO NOT EDIT. -->

${body}
`;
}

// Process all mdx files
function processFiles() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const files = fs.readdirSync(DOCS_DIR);
  const mdxFiles = files.filter(
    (file) => file.endsWith(".mdx") && !file.startsWith("_")
  );

  console.log(`Found ${mdxFiles.length} mdx files to process\n`);

  let generated = 0;
  let errors = 0;

  for (const file of mdxFiles) {
    const filePath = path.join(DOCS_DIR, file);
    const skillName = getSkillName(file);
    const outputDir = path.join(OUTPUT_DIR, skillName);
    const outputPath = path.join(outputDir, "SKILL.md");

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const { frontmatter, body } = parseFrontmatter(content);
      const skillContent = generateSkillContent(file, frontmatter, body);

      // Create skill directory
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(outputPath, skillContent, "utf-8");
      console.log(`✅ ${skillName}`);
      generated++;
    } catch (error) {
      console.error(`❌ ${file}: ${error.message}`);
      errors++;
    }
  }

  return { generated, errors };
}

// Main function
function main() {
  console.log("🚀 Generating MCP skills from docs/v7/*.mdx files...\n");
  console.log(`📂 Source: ${DOCS_DIR}`);
  console.log(`📂 Output: ${OUTPUT_DIR}\n`);

  const { generated, errors } = processFiles();

  console.log(`\n✨ Complete!`);
  console.log(`   Generated: ${generated} skills`);
  if (errors > 0) {
    console.log(`   Errors: ${errors}`);
  }
  console.log(`\nSkills written to: ${OUTPUT_DIR}`);
}

// Handle command line arguments
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
MCP Skills Generator

Usage: node generate-skills.js [options]

Options:
  --help, -h    Show this help message

Description:
  This script generates MCP skill files from the docs/v7/*.mdx documentation.
  
  Each .mdx file is converted to a SKILL.md file with:
  - name: testdriver:<filename>
  - description: from frontmatter
  - Content: the mdx body
  
  Output is written to the skills/ directory.
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
