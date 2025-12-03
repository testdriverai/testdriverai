#!/usr/bin/env node

/**
 * TestDriver SDK - Simple Example with AWESOME Logs 🎨
 *
 * A straightforward example showing the beautiful logging in action.
 *
 * Run: TD_API_KEY=your_key node examples/sdk-simple-example.js
 */

const TestDriver = require("../sdk.js");

(async () => {
  try {
    // Create client with logging enabled (default)
    const client = new TestDriver(process.env.TD_API_KEY, {
      os: "windows",
      logging: true, // This enables the awesome logs!
    });

    console.log("\n🚀 Starting TestDriver SDK Example...\n");

    // Connect to sandbox - you'll see: 🔌 Connected
    await client.connect({ headless: true });

    // Navigate to a test page
    await client.focusApplication("Google Chrome");
    await client.type("https://example.com");
    await client.pressKeys(["enter"]);

    // Wait for page load
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Find an element - you'll see: 🔍 Found "heading..." · 📍 (x, y) · ⏱️ XXXms · ⚡ cached
    const heading = await client.find("heading that says Example Domain");

    if (heading.found()) {
      // Click the element - you'll see: 👆 Click "heading..."
      await heading.click();
    }

    // Find another element
    const link = await client.find("More information link");

    if (link.found()) {
      // Hover over it - you'll see: 👉 Hover "More information link"
      await link.hover();
    }

    // Scroll down - you'll see: 📜 Scroll
    await client.scroll("down", 300);

    // Take a screenshot - you'll see: 📸 Screenshot
    const screenshot = await client.screenshot();
    console.log(`\n📸 Screenshot captured (${screenshot.length} bytes)\n`);

    // Disconnect - you'll see: 🔌 Disconnected
    await client.disconnect();

    console.log("\n✅ Example completed successfully!\n");
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
})();
