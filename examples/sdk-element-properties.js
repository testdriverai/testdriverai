#!/usr/bin/env node

/**
 * TestDriver SDK - Element Properties Example
 *
 * This example demonstrates accessing all available properties from located elements,
 * including coordinates, dimensions, confidence scores, screenshots, and more.
 */

const TestDriverSDK = require("../sdk");

(async () => {
  const client = new TestDriverSDK(process.env.TD_API_KEY);

  try {
    await client.connect();

    // Example 1: Basic coordinate properties
    console.log("=== Example 1: Basic Coordinates ===");
    const button = await client.find("the login button");

    if (button.found()) {
      console.log("Button found!");
      console.log("  X (top-left):", button.x);
      console.log("  Y (top-left):", button.y);
      console.log("  Center X:", button.centerX);
      console.log("  Center Y:", button.centerY);
      console.log("  Coordinates object:", button.getCoordinates());
    }

    // Example 2: Element dimensions
    console.log("\n=== Example 2: Element Dimensions ===");
    const input = await client.find("username input field");

    if (input.found()) {
      console.log("Input field found!");
      console.log("  Width:", input.width);
      console.log("  Height:", input.height);

      if (input.boundingBox) {
        console.log("  Bounding box:", input.boundingBox);
      }
    }

    // Example 3: Confidence and text data
    console.log("\n=== Example 3: Match Quality & Text ===");
    const link = await client.find("sign up link");

    if (link.found()) {
      console.log("Link found!");
      console.log("  Confidence score:", link.confidence);
      console.log("  Text content:", link.text);
      console.log("  Label:", link.label);
    }

    // Example 4: Screenshot data
    console.log("\n=== Example 4: Element Screenshot ===");
    const icon = await client.find("settings icon");

    if (icon.found() && icon.screenshot) {
      console.log("Icon found with screenshot!");
      console.log("  Screenshot (base64) length:", icon.screenshot.length);

      // You could save this to a file:
      // const fs = require('fs');
      // fs.writeFileSync('element.png', Buffer.from(icon.screenshot, 'base64'));
    }

    // Example 5: Full API response
    console.log("\n=== Example 5: Full API Response ===");
    const widget = await client.find("main content area");

    if (widget.found()) {
      const fullResponse = widget.getResponse();
      console.log("Full API response:", JSON.stringify(fullResponse, null, 2));

      // Log all available properties
      if (fullResponse) {
        console.log("\nAll available properties:");
        Object.keys(fullResponse).forEach((key) => {
          const value = fullResponse[key];
          const preview =
            typeof value === "string" && value.length > 50
              ? value.substring(0, 50) + "..."
              : value;
          console.log(`  ${key}:`, preview);
        });
      }
    }

    // Example 6: Property-based validation
    console.log("\n=== Example 6: Property-based Validation ===");
    const message = await client.find("error message");

    if (message.found()) {
      // Check position
      if (message.centerY < 200) {
        console.log("✓ Error message is at top of screen");
      }

      // Check confidence
      if (message.confidence && message.confidence > 0.9) {
        console.log("✓ High confidence match (", message.confidence, ")");
      }

      // Check text content
      if (message.text) {
        console.log("✓ Message text:", message.text);
      }
    }

    // Example 7: Position-based logic
    console.log("\n=== Example 7: Position-based Logic ===");
    const menu = await client.find("dropdown menu");

    if (menu.found()) {
      // Calculate positions
      const offsetX = menu.x + 10;
      const offsetY = menu.y + 20;
      console.log("Menu position:", { x: menu.x, y: menu.y });
      console.log("Offset position:", { x: offsetX, y: offsetY });

      // Check if element is in viewport
      const viewportHeight = 768;
      if (menu.y > 0 && menu.y < viewportHeight) {
        console.log("✓ Element is visible in viewport");
      }
    }

    // Example 8: Conditional actions based on properties
    console.log("\n=== Example 8: Conditional Actions ===");
    const notification = await client.find("notification popup");

    if (notification.found()) {
      // Only interact if confidence is high
      if (notification.confidence && notification.confidence > 0.8) {
        console.log("High confidence, clicking notification");
        await notification.click();
      } else {
        console.log("Low confidence, skipping interaction");
        console.log("Debug info:", {
          coordinates: notification.getCoordinates(),
          confidence: notification.confidence,
          text: notification.text,
        });
      }
    }

    await client.disconnect();
  } catch (error) {
    console.error("Test failed:", error);
    await client.disconnect();
    process.exit(1);
  }
})();
