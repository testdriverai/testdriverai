#!/usr/bin/env node

/**
 * TestDriver SDK - Cache Thresholds Example
 *
 * This example demonstrates how to configure cache thresholds for different
 * operations and view cache debugging information.
 *
 * Run with VERBOSE=true to see cache hit/miss information:
 * TD_API_KEY=your_key VERBOSE=true node examples/sdk-cache-thresholds.js
 */

const TestDriver = require("../sdk.js");

(async () => {
  try {
    // Create client with custom cache thresholds
    const client = new TestDriver(process.env.TD_API_KEY, {
      os: "windows",
      logging: true,
      cacheThreshold: {
        find: 0.03, // 3% difference = 97% similarity required for cache hit
        findAll: 0.05, // 5% difference = 95% similarity required for cache hit
      },
    });

    console.log("\n=== TestDriver SDK - Cache Thresholds Demo ===\n");
    console.log("Cache thresholds configured:");
    console.log("  - find: 0.03 (97% similarity required)");
    console.log("  - findAll: 0.05 (95% similarity required)\n");
    console.log("You can also override thresholds per-command:");
    console.log('  await client.find("element", 0.01) // 99% similarity\n');

    // Connect to sandbox
    console.log("Connecting to sandbox...");
    await client.connect({ headless: true });

    // Open a test page
    console.log("Opening test page...");
    await client.focusApplication("Google Chrome");
    await client.type("https://example.com");
    await client.pressKeys(["enter"]);

    // Wait for page load
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Example 1: First find - should be a cache MISS
    console.log("\n--- First find (cache MISS expected) ---");
    const heading1 = await client.find("heading that says Example Domain");

    if (heading1.found()) {
      console.log(`✓ Element found at (${heading1.x}, ${heading1.y})`);
    }

    // Example 2: Second find - should be a cache HIT (same element, same screen)
    console.log("\n--- Second find (cache HIT expected) ---");
    // eslint-disable-next-line no-unused-vars
    const _heading2 = await client.find("heading that says Example Domain");

    // Example 3: Find with custom threshold override
    console.log("\n--- Find with strict threshold (0.01 = 99% similarity) ---");
    // eslint-disable-next-line no-unused-vars
    const _heading3 = await client.find(
      "heading that says Example Domain",
      0.01,
    );

    // Example 4: Find a different element - cache MISS
    console.log("\n--- Finding different element (cache MISS expected) ---");
    // eslint-disable-next-line no-unused-vars
    const _paragraph = await client.find(
      "paragraph with text about illustrative examples",
    );

    // Example 5: Find the same paragraph again - cache HIT
    console.log("\n--- Finding same paragraph again (cache HIT expected) ---");
    // eslint-disable-next-line no-unused-vars
    const _paragraph2 = await client.find(
      "paragraph with text about illustrative examples",
    );

    console.log("\n=== Demo Complete ===");
    console.log(
      "\nNote: Run with VERBOSE=true to see detailed cache information:",
    );
    console.log("  - Cache hit/miss status");
    console.log("  - Cache strategy (image/text)");
    console.log("  - Similarity scores");
    console.log("  - Response times\n");

    await client.disconnect();
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
})();
