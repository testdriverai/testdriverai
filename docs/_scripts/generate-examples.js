#!/usr/bin/env node

/**
 * Generate Example Docs from Test Files
 * 
 * Reads example test files and the examples manifest to generate
 * MDX documentation pages with embedded test run iframes.
 * 
 * Usage:
 *   node generate-examples.js
 *   node generate-examples.js --dry-run
 *   node generate-examples.js --skip-ai
 */

const fs = require("fs");
const path = require("path");

// Paths
const EXAMPLES_DIR = path.join(__dirname, "../../examples");
const MANIFEST_PATH = path.join(__dirname, "../_data/examples-manifest.json");
const OUTPUT_DIR = path.join(__dirname, "../v7/examples");
const DOCS_JSON_PATH = path.join(__dirname, "../docs.json");

// Icon mapping based on test type/content
const ICON_MAP = {
  ai: "wand-magic-sparkles",
  assert: "check-circle",
  captcha: "shield-check",
  chrome: "chrome",
  drag: "arrows-up-down-left-right",
  exec: "terminal",
  focus: "window-maximize",
  hover: "hand-pointer",
  installer: "download",
  match: "image",
  press: "keyboard",
  scroll: "scroll",
  type: "keyboard",
  prompt: "message",
  element: "crosshairs",
  window: "window-maximize",
  default: "play",
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes("--dry-run"),
    help: args.includes("--help") || args.includes("-h"),
    verbose: args.includes("--verbose") || args.includes("-v"),
  };
}

// Load manifest
function loadManifest() {
  try {
    const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.warn("⚠️  No manifest found, generating docs without URLs");
    return { examples: {} };
  }
}

// Load docs.json
function loadDocsJson() {
  const content = fs.readFileSync(DOCS_JSON_PATH, "utf-8");
  return JSON.parse(content);
}

// Save docs.json
function saveDocsJson(docsJson) {
  fs.writeFileSync(DOCS_JSON_PATH, JSON.stringify(docsJson, null, 2) + "\n", "utf-8");
}

// Get all example files
function getExampleFiles() {
  return fs
    .readdirSync(EXAMPLES_DIR)
    .filter((f) => f.endsWith(".test.mjs"))
    .sort();
}

// Parse test file to extract metadata
function parseTestFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const filename = path.basename(filePath);

  // Extract JSDoc comment at top of file
  const jsdocMatch = content.match(/^\/\*\*\n([\s\S]*?)\n\s*\*\//);
  const jsdoc = jsdocMatch
    ? jsdocMatch[1]
        .split("\n")
        .map((line) => line.replace(/^\s*\*\s?/, "").trim())
        .filter((line) => line && !line.startsWith("@"))
        .join(" ")
    : null;

  // Extract describe() name
  const describeMatch = content.match(/describe\s*\(\s*["'`]([^"'`]+)["'`]/);
  const describeName = describeMatch ? describeMatch[1] : null;

  // Extract it() name
  const itMatch = content.match(/it\s*\(\s*["'`]([^"'`]+)["'`]/);
  const itName = itMatch ? itMatch[1] : null;

  // Get icon based on filename
  const icon = Object.entries(ICON_MAP).find(([key]) =>
    filename.toLowerCase().includes(key)
  )?.[1] || ICON_MAP.default;

  return {
    filename,
    content,
    jsdoc,
    describeName,
    itName,
    icon,
  };
}

// Generate slug from filename
function generateSlug(filename) {
  return filename
    .replace(".test.mjs", "")
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase();
}

// Generate human-readable title from filename
function generateTitle(filename, describeName) {
  if (describeName) {
    return describeName;
  }
  return filename
    .replace(".test.mjs", "")
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Generate short sidebar title
function generateSidebarTitle(filename) {
  return filename
    .replace(".test.mjs", "")
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Call OpenAI API to generate description
async function generateAIDescription(testMeta, options) {
  if (options.skipAi) {
    return generateFallbackDescription(testMeta);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("⚠️  OPENAI_API_KEY not set, using fallback descriptions");
    return generateFallbackDescription(testMeta);
  }

  const prompt = `You are a technical writer for TestDriver.ai documentation. Generate a concise 2-3 paragraph description for this test example.

Test file: ${testMeta.filename}
Test suite name: ${testMeta.describeName || "N/A"}
Test name: ${testMeta.itName || "N/A"}
JSDoc: ${testMeta.jsdoc || "N/A"}

Test code:
\`\`\`javascript
${testMeta.content}
\`\`\`

Write a description that:
1. Explains what this test demonstrates (first paragraph)
2. Describes the key TestDriver SDK methods used (second paragraph)
3. Mentions any important patterns or best practices shown (optional third paragraph)

Keep it professional and focused on helping developers understand the example. Do not include code blocks in your response.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.warn(`⚠️  AI generation failed for ${testMeta.filename}: ${error.message}`);
    return generateFallbackDescription(testMeta);
  }
}

// Generate fallback description when AI is not available
function generateFallbackDescription(testMeta) {
  const parts = [];

  if (testMeta.jsdoc) {
    parts.push(testMeta.jsdoc);
  } else if (testMeta.describeName && testMeta.itName) {
    parts.push(
      `This example demonstrates the "${testMeta.describeName}" test suite. Specifically, it shows how to ${testMeta.itName.toLowerCase()}.`
    );
  } else {
    const title = generateTitle(testMeta.filename, testMeta.describeName);
    parts.push(
      `This example demonstrates ${title.toLowerCase()} functionality using TestDriver.ai.`
    );
  }

  parts.push(
    "\nReview the source code below to understand the implementation details and patterns used."
  );

  return parts.join("\n");
}

// Generate short description for frontmatter
function generateShortDescription(testMeta) {
  if (testMeta.jsdoc) {
    // Take first sentence
    const firstSentence = testMeta.jsdoc.split(/\.\s/)[0];
    return firstSentence.endsWith(".") ? firstSentence : firstSentence + ".";
  }
  if (testMeta.itName) {
    return `Example: ${testMeta.itName}`;
  }
  return `TestDriver example for ${generateTitle(testMeta.filename, testMeta.describeName).toLowerCase()}`;
}

// Extract testcase ID from manifest URL
// URL format: http://localhost:3001/runs/{runId}/{testcaseId}
function extractTestcaseId(url) {
  if (!url) return null;
  const pathParts = new URL(url).pathname.split('/').filter(Boolean);
  // The testcase ID is the last segment (e.g., /runs/runId/testcaseId)
  return pathParts.length >= 2 ? pathParts[pathParts.length - 1] : null;
}

// Generate replay URL from testcase ID
function generateReplayUrl(testcaseId) {
  // Use the API replay endpoint which handles the redirect with embed=true
  const apiRoot = process.env.TD_API_ROOT || 'https://api.testdriver.ai';
  return `${apiRoot}/api/v1/testdriver/testcase/${testcaseId}/replay`;
}

// Update existing MDX file by finding the marker comment and replacing the iframe
function updateExistingMDX(existingContent, filename, testcaseId) {
  const marker = `{/* ${filename} output */}`;
  
  if (!existingContent.includes(marker)) {
    return null; // Marker not found, can't update
  }
  
  const replayUrl = generateReplayUrl(testcaseId);
  
  // Pattern to match the marker followed by the iframe tag
  const pattern = new RegExp(
    `(\\{/\\* ${filename.replace('.', '\\.')} output \\*/\\}\\s*)<iframe[^>]*src="[^"]*"([^]*)/>`,
    's'
  );
  
  const replacement = `$1<iframe \n  src="${replayUrl}"$2/>`;
  const updated = existingContent.replace(pattern, replacement);
  
  if (updated === existingContent) {
    return null; // No change made
  }
  
  return updated;
}

// Generate MDX content
function generateMDX(testMeta, manifest, description) {
  const slug = generateSlug(testMeta.filename);
  const title = generateTitle(testMeta.filename, testMeta.describeName);
  const sidebarTitle = generateSidebarTitle(testMeta.filename);
  const shortDescription = generateShortDescription(testMeta);
  const manifestEntry = manifest.examples[testMeta.filename];
  const testcaseId = manifestEntry?.url ? extractTestcaseId(manifestEntry.url) : null;

  let mdx = `---
title: "${title}"
sidebarTitle: "${sidebarTitle}"
description: "${shortDescription.replace(/"/g, '\\"')}"
icon: "${testMeta.icon}"
---

## Overview

${description}

`;

  // Add Live Test Run section if URL exists
  if (testcaseId) {
    const replayUrl = generateReplayUrl(testcaseId);
    mdx += `## Live Test Run

Watch this test execute in a real sandbox environment:

{/* ${testMeta.filename} output */}
<iframe 
  src="${replayUrl}" 
  width="100%" 
  height="600" 
  style={{ border: "1px solid #333", borderRadius: "8px" }}
  allow="fullscreen"
/>

`;
  } else {
    mdx += `## Live Test Run

<Note>
  A live test recording will be available after the next CI run.
</Note>

`;
  }

  // Add Source Code section
  mdx += `## Source Code

\`\`\`javascript title="${testMeta.filename}"
${testMeta.content.trim()}
\`\`\`

## Running This Example

\`\`\`bash
# Clone the TestDriver repository
git clone https://github.com/testdriverai/testdriverai

# Install dependencies
cd testdriverai
npm install

# Run this specific example
npx vitest run examples/${testMeta.filename}
\`\`\`

<Note>
  Make sure you have \`TD_API_KEY\` set in your environment. Get one at [testdriver.ai](https://testdriver.ai).
</Note>
`;

  return mdx;
}

// Update docs.json navigation
function updateDocsNavigation(docsJson, examplePages, options) {
  // Find v7 version in navigation
  const v7Version = docsJson.navigation.versions.find((v) => v.version === "v7");
  if (!v7Version) {
    console.error("❌ Could not find v7 version in docs.json");
    return false;
  }

  // Find or create Examples group
  let examplesGroup = v7Version.groups.find((g) => 
    g.group === "Examples" || 
    (typeof g === "object" && g.group === "Examples")
  );

  const examplesPages = examplePages.map((slug) => `/v7/examples/${slug}`);

  if (examplesGroup) {
    // Update existing group
    examplesGroup.pages = examplesPages;
    if (options.verbose) {
      console.log("🔄 Updated existing Examples group in navigation");
    }
  } else {
    // Create new group after Overview
    const overviewIndex = v7Version.groups.findIndex((g) => g.group === "Overview");
    const newGroup = {
      group: "Examples",
      icon: "code",
      pages: examplesPages,
    };
    
    if (overviewIndex !== -1) {
      v7Version.groups.splice(overviewIndex + 1, 0, newGroup);
    } else {
      v7Version.groups.push(newGroup);
    }
    
    if (options.verbose) {
      console.log("➕ Added new Examples group to navigation");
    }
  }

  return true;
}

// Show help
function showHelp() {
  console.log(`
Update Example Docs Iframe URLs

Usage:
  node generate-examples.js [options]

Options:
  --dry-run     Preview changes without writing files
  --verbose     Show detailed output
  --help, -h    Show this help message

Environment Variables:
  TD_API_ROOT       API root URL (default: https://api.testdriver.ai)

Description:
  Reads existing MDX files in docs/v7/examples/ and updates the iframe
  src URLs based on the examples-manifest.json.
  
  Files must contain a marker comment like: {/* filename.test.mjs output */}
  The iframe following the marker will have its src updated to the
  API replay endpoint.
`);
}

// Main function
async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  console.log("🚀 Updating example documentation iframes...\n");

  if (options.dryRun) {
    console.log("📋 DRY RUN - no files will be written\n");
  }

  // Load manifest
  const manifest = loadManifest();

  // Get existing MDX files in output directory
  const existingFiles = fs.existsSync(OUTPUT_DIR) 
    ? fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith(".mdx"))
    : [];

  console.log(`📂 Found ${existingFiles.length} existing MDX files\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const mdxFile of existingFiles) {
    const outputPath = path.join(OUTPUT_DIR, mdxFile);

    try {
      const existingContent = fs.readFileSync(outputPath, 'utf-8');
      
      // Find the marker in the file to get the test filename
      const markerMatch = existingContent.match(/\{\/\* ([^*]+\.test\.mjs) output \*\/\}/);
      
      if (!markerMatch) {
        skipped++;
        if (options.verbose) {
          console.log(`⏭️  ${mdxFile} (no marker)`);
        }
        continue;
      }
      
      const testFilename = markerMatch[1];
      const manifestEntry = manifest.examples[testFilename];
      const testcaseId = manifestEntry?.url ? extractTestcaseId(manifestEntry.url) : null;
      
      if (!testcaseId) {
        skipped++;
        if (options.verbose) {
          console.log(`⏭️  ${mdxFile} (no URL in manifest for ${testFilename})`);
        }
        continue;
      }
      
      const updatedContent = updateExistingMDX(existingContent, testFilename, testcaseId);
      
      if (updatedContent) {
        if (!options.dryRun) {
          fs.writeFileSync(outputPath, updatedContent, 'utf-8');
        }
        updated++;
        console.log(`🔄 ${mdxFile} (updated iframe)`);
      } else {
        skipped++;
        if (options.verbose) {
          console.log(`⏭️  ${mdxFile} (unchanged)`);
        }
      }
    } catch (error) {
      console.error(`❌ ${mdxFile}: ${error.message}`);
      errors++;
    }
  }

  console.log(`\n✨ Complete!`);
  console.log(`   Updated: ${updated} docs`);
  console.log(`   Skipped: ${skipped} unchanged`);
  if (errors > 0) {
    console.log(`   Errors: ${errors}`);
  }
  console.log(`\n📂 Output: ${OUTPUT_DIR}`);

  if (options.dryRun) {
    console.log("\n⚠️  This was a dry run - no files were written");
  }
}

// Run
main().catch((error) => {
  console.error("❌ Fatal error:", error.message);
  process.exit(1);
});
