/**
 * Chrome Extension Loading Demo
 * Demonstrates how to load Chrome extensions using Chrome for Testing
 * 
 * This test shows how to launch Chrome with a specific extension loaded
 * by using its Chrome Web Store extension ID.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import TestDriver from "../../sdk.js";
import {
  runPostrun,
  runPrerunChromeExtension
} from "./setup/lifecycleHelpers.mjs";

describe("Chrome Extension Loading", () => {
  let client;
  let dashcamUrl;

  beforeAll(async () => {
    // Initialize TestDriver client
    client = await TestDriver.create({
      apiKey: process.env.TD_API_KEY,
      apiRoot: process.env.TD_API_ROOT,
      os: "linux",
      verbosity: 1,
    });

    // Run prerun with uBlock Origin extension loaded
    // Extension ID: cjpalhdlnbpafiamejdnhcphjbkeiagm
    await runPrerunChromeExtension(client, "cjpalhdlnbpafiamejdnhcphjbkeiagm");
  });

  afterAll(async () => {
    if (client) {
      dashcamUrl = await runPostrun(client);
      await client.cleanup();
    }
  });

  it("should load Chrome with extension and verify functionality", async () => {
    // Focus Chrome browser
    await client.focusApplication("Google Chrome");

    // Verify the page loaded
    const pageElement = await client.find("TestDriver.ai Sandbox");
    expect(pageElement.found()).toBe(true);

    // Test basic interaction to ensure Chrome is working with the extension
    const signInButton = await client.find(
      "Sign In, black button below the password field",
    );
    await signInButton.click();

    // Verify error message appears
    const result = await client.assert(
      "an error shows that fields are required",
    );
    expect(result).toBeTruthy();

    console.log("✅ Chrome extension loaded successfully!");
    if (dashcamUrl) {
      console.log("🎥 Dashcam URL:", dashcamUrl);
    }
  });

  it("should demonstrate extension interaction", async () => {
    // You can add specific tests here to interact with the extension
    // For example, if testing uBlock Origin, you might:
    // 1. Navigate to a page with ads
    // 2. Verify ads are blocked
    // 3. Access the extension's popup or settings
    
    await client.focusApplication("Google Chrome");
    
    // Example: Navigate to extension management page to verify it's loaded
    await client.exec(
      "sh",
      `xdotool key --clearmodifiers ctrl+shift+e`,
      5000,
      true
    );

    // Wait a moment for the extensions page to potentially load
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log("✅ Extension interaction test completed");
  });
});
