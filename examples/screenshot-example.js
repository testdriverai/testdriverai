/**
 * TestDriver SDK - Screenshot Example
 *
 * This example demonstrates how to use the screenshot() method
 * to capture screenshots of the sandbox environment.
 */

const TestDriver = require("../sdk.js");
const fs = require("fs");
const path = require("path");

async function main() {
  // Initialize TestDriver SDK
  const client = new TestDriver(process.env.TD_API_KEY);

  try {
    // Connect to sandbox
    console.log("Connecting to sandbox...");
    await client.connect();

    // Navigate to a website
    console.log("Opening Chrome and navigating to example.com...");
    await client.focusApplication("Google Chrome");
    const urlBar = await client.find("URL bar in Chrome");
    await urlBar.click();
    await client.type("https://example.com");
    await client.pressKeys(["enter"]);

    // Wait a moment for page to load
    await client.wait(2000);

    // Capture a screenshot
    console.log("Capturing screenshot...");
    const screenshot = await client.screenshot();

    // Save screenshot to file
    const outputPath = path.join(__dirname, "example-screenshot.png");
    fs.writeFileSync(outputPath, Buffer.from(screenshot, "base64"));
    console.log(`Screenshot saved to: ${outputPath}`);

    // You can also capture with the mouse cursor visible
    console.log("Capturing screenshot with mouse cursor...");
    await client.hover(400, 300);
    const screenshotWithMouse = await client.screenshot(1, false, true);

    const outputPathWithMouse = path.join(
      __dirname,
      "example-screenshot-with-mouse.png",
    );
    fs.writeFileSync(
      outputPathWithMouse,
      Buffer.from(screenshotWithMouse, "base64"),
    );
    console.log(`Screenshot with mouse saved to: ${outputPathWithMouse}`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    // Clean up
    await client.disconnect();
  }
}

main();
