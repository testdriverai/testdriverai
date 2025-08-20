#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const { glob } = require("glob");

// Configuration
const DOCS_DIR = path.join(__dirname, "docs");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const VECTOR_STORE_NAME = "testdriverai-docs";

if (!OPENAI_API_KEY) {
  console.error("Error: OPENAI_API_KEY environment variable is required");
  process.exit(1);
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

/**
 * Parse MDX file to extract frontmatter and content
 */
function parseMdxFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");

  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    return {
      metadata: {},
      content: content,
      title: path.basename(filePath, ".mdx"),
      filePath: path.relative(DOCS_DIR, filePath),
    };
  }

  const frontmatter = frontmatterMatch[1];
  const mainContent = frontmatterMatch[2];

  // Parse frontmatter (simple YAML-like parsing)
  const metadata = {};
  frontmatter.split("\n").forEach((line) => {
    const match = line.match(/^([^:]+):\s*"?([^"]*)"?$/);
    if (match) {
      metadata[match[1].trim()] = match[2].trim();
    }
  });

  return {
    metadata,
    content: mainContent,
    title: metadata.title || path.basename(filePath, ".mdx"),
    filePath: path.relative(DOCS_DIR, filePath),
  };
}

/**
 * Get all MDX files in the docs directory
 */
async function getAllMdxFiles() {
  const pattern = path.join(DOCS_DIR, "**/*.mdx");
  const files = await glob(pattern);
  return files;
}

/**
 * Create a vector store
 */
async function createVectorStore() {
  try {
    const vectorStore = await openai.vectorStores.create({
      name: VECTOR_STORE_NAME,
      expires_after: {
        anchor: "last_active_at",
        days: 365,
      },
    });

    console.log(`✅ Created vector store: ${vectorStore.id}`);
    return vectorStore;
  } catch (error) {
    console.error("Error creating vector store:", error);
    throw error;
  }
}

/**
 * Upload a single file to the vector store
 */
async function uploadSingleFile(vectorStoreId, file) {
  try {
    console.log(`📁 Processing: ${file.filePath}`);

    // Create a temporary file with processed content
    const tempFilePath = `/tmp/testdriverai-${Date.now()}-${Math.random()}-${path.basename(file.filePath)}.txt`;

    // Format the content for better vector search
    const formattedContent = `Title: ${file.title}
File: ${file.filePath}
${file.metadata.description ? `Description: ${file.metadata.description}` : ""}
${file.metadata.sidebarTitle ? `Sidebar Title: ${file.metadata.sidebarTitle}` : ""}

${file.content}`;

    fs.writeFileSync(tempFilePath, formattedContent);

    // Upload to OpenAI and add to vector store
    const vectorStoreFile = await openai.vectorStores.files.createAndPoll(
      vectorStoreId,
      {
        file_id: (
          await openai.files.create({
            file: fs.createReadStream(tempFilePath),
            purpose: "assistants",
          })
        ).id,
      },
    );

    // Clean up temp file
    fs.unlinkSync(tempFilePath);

    console.log(`✅ Uploaded: ${file.title} (${vectorStoreFile.id})`);

    return {
      vectorStoreFileId: vectorStoreFile.id,
      originalPath: file.filePath,
      title: file.title,
    };
  } catch (error) {
    console.error(`❌ Error uploading ${file.filePath}:`, error);
    return null;
  }
}

/**
 * Upload files to the vector store in parallel
 */
async function uploadFilesToVectorStore(vectorStoreId, files) {
  console.log(`📤 Uploading ${files.length} files in parallel...`);

  // Process files in parallel with a concurrency limit
  const BATCH_SIZE = 10; // Process 10 files at a time to avoid overwhelming the API
  const uploadedFiles = [];

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    console.log(
      `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(files.length / BATCH_SIZE)} (${batch.length} files)`,
    );

    const batchPromises = batch.map((file) =>
      uploadSingleFile(vectorStoreId, file),
    );
    const batchResults = await Promise.all(batchPromises);

    // Filter out failed uploads (null results)
    const successfulUploads = batchResults.filter((result) => result !== null);
    uploadedFiles.push(...successfulUploads);

    console.log(
      `✅ Batch complete: ${successfulUploads.length}/${batch.length} files uploaded successfully`,
    );
  }

  return uploadedFiles;
}

/**
 * Wait for vector store to be ready
 */
async function waitForVectorStoreReady(vectorStoreId) {
  console.log("⏳ Waiting for vector store to process files...");

  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    try {
      const vectorStore = await openai.vectorStores.retrieve(vectorStoreId);

      if (vectorStore.status === "completed") {
        console.log("✅ Vector store is ready!");
        return vectorStore;
      }

      if (vectorStore.status === "failed") {
        throw new Error("Vector store processing failed");
      }

      console.log(
        `⏳ Status: ${vectorStore.status}, Files: ${vectorStore.file_counts.completed}/${vectorStore.file_counts.total}`,
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;
    } catch (error) {
      console.error("Error checking vector store status:", error);
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  throw new Error("Timeout waiting for vector store to be ready");
}

/**
 * Main function
 */
async function main() {
  try {
    console.log(
      "🚀 Starting TestDriver.ai docs upload to OpenAI Vector Store...\n",
    );

    // Get all MDX files
    console.log("📂 Finding MDX files...");
    const mdxFilePaths = await getAllMdxFiles();
    console.log(`Found ${mdxFilePaths.length} MDX files\n`);

    // Parse all MDX files
    console.log("📝 Parsing MDX files...");
    const parsedFiles = mdxFilePaths.map((filePath) => parseMdxFile(filePath));
    console.log(`Parsed ${parsedFiles.length} files\n`);

    // Create vector store
    console.log("🗂️ Creating vector store...");
    const vectorStore = await createVectorStore();
    console.log("");

    // Upload files to vector store
    console.log("📤 Uploading files to OpenAI Vector Store...");
    const uploadedFiles = await uploadFilesToVectorStore(
      vectorStore.id,
      parsedFiles,
    );
    console.log("");

    // Wait for processing
    await waitForVectorStoreReady(vectorStore.id);

    console.log("\n🎉 Upload complete!");
    console.log(`Vector Store ID: ${vectorStore.id}`);
    console.log(`Files uploaded: ${uploadedFiles.length}`);
    console.log(
      "\nYou can now use this vector store ID in your OpenAI Assistant or for retrieval.",
    );

    // Save results to file
    const results = {
      vectorStoreId: vectorStore.id,
      uploadedFiles: uploadedFiles,
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(__dirname, "openai-vector-store-results.json"),
      JSON.stringify(results, null, 2),
    );

    console.log("\n📄 Results saved to openai-vector-store-results.json");
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  main,
  parseMdxFile,
  getAllMdxFiles,
  createVectorStore,
  uploadSingleFile,
  uploadFilesToVectorStore,
};
