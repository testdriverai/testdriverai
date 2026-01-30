const fs = require("fs");
const path = require("path");

const docsDir = path.resolve(__dirname, "../docs/v7");
const skillsDir = path.resolve(__dirname, "../claude-testdriver/skills");

console.log(`Generating skills from ${docsDir} to ${skillsDir}`);

if (!fs.existsSync(skillsDir)) {
  fs.mkdirSync(skillsDir, { recursive: true });
}

// Function to clean up markdown content
function processContent(content) {
  // Remove frontmatter
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  let description = "";
  let body = content;

  if (match) {
    const frontmatter = match[1];
    // Parse description
    const descMatch = frontmatter.match(/description:\s*["']?(.*?)["']?$/m);
    if (descMatch) {
      description = descMatch[1];
    }

    // Remove frontmatter from body
    body = content.replace(frontmatterRegex, "").trim();
  }

  return { description, body };
}

// Read all MDX files
let count = 0;

// Function to process a directory
function processDirectory(sourceDir) {
  if (!fs.existsSync(sourceDir)) {
    console.log(`Directory not found: ${sourceDir}`);
    return;
  }

  const files = fs.readdirSync(sourceDir);

  files.forEach((file) => {
    if (!file.endsWith(".mdx") && !file.endsWith(".md")) return;

    const filePath = path.join(sourceDir, file);
    if (fs.lstatSync(filePath).isDirectory()) return;

    // Use filename handling for both .md and .mdx
    const skillName = path.basename(file, path.extname(file));
    const skillPath = path.join(skillsDir, `testdriver:${skillName}`);

    // Read content
    const content = fs.readFileSync(filePath, "utf-8");
    const { description, body } = processContent(content);

    // Ensure description exists
    const finalDescription = description || `TestDriver ${skillName} skill`;

    // Ensure skill directory exists
    if (!fs.existsSync(skillPath)) {
      fs.mkdirSync(skillPath, { recursive: true });
    }

    // Create SKILL.md content
    const skillContent = `---
name: testdriver:${skillName}
description: ${finalDescription}
---
<!-- Generated from ${file}. DO NOT EDIT. -->

${body}
`;

    fs.writeFileSync(path.join(skillPath, "SKILL.md"), skillContent);
    count++;
  });
}

// Process docs
processDirectory(docsDir);

// Process agents
const agentsDir = path.resolve(__dirname, "../claude-testdriver/agents");
console.log(`Generating skills from ${agentsDir} to ${skillsDir}`);
processDirectory(agentsDir);

console.log(`Successfully generated ${count} skills.`);
