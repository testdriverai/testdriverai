/**
 * TestDriver SDK - Chrome Extension Test (Vitest)
 * Tests loading a Chrome extension using provision.chromeExtension()
 * 
 * This test suite covers:
 * 1. Loading extension from local path (extensionPath)
 * 2. Loading extension from Chrome Web Store (extensionId)
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";

describe("Chrome Extension Test", () => {
  it("should load hello-world Chrome extension from local path", async (context) => {
    const testdriver = TestDriver(context, { headless: false, newSandbox: true, cacheKey: 'chrome-extension-path-test' });
    
    // Wait for connection to be ready before running exec
    await testdriver.ready();
    
    // Clone the Chrome extensions samples repo
    await testdriver.exec(
      'sh',
      'git clone --depth 1 https://github.com/GoogleChrome/chrome-extensions-samples.git /tmp/chrome-extensions-samples',
      60000,
      true
    );

    // Launch Chrome with the hello-world extension loaded
    await testdriver.provision.chromeExtension({
      extensionPath: '/tmp/chrome-extensions-samples/functional-samples/tutorial.hello-world',
      url: 'https://testdriver.ai'
    });

    // The hello-world extension adds a puzzle piece icon to the toolbar
    // When clicked, it shows a popup with "Hello Extensions"
    
    // First, let's verify Chrome loaded and we can see the page
    const pageResult = await testdriver.assert("the testdriver.ai website is visible");
    expect(pageResult).toBeTruthy();

    // Click on the extensions button (puzzle piece icon) in Chrome toolbar
    const extensionsButton = await testdriver.find("The icon of a puzzle piece in the chrome toolbar. NOT THE BEAKER.");
    await extensionsButton.click();

    // Look for the hello world extension in the extensions menu
    const helloExtension = await testdriver.find("Hello World extension in the extensions dropdown");
    await helloExtension.click();

    // Verify the extension popup shows "Hello Extensions" text
    const popupResult = await testdriver.assert("a popup shows with the text 'Hello Extensions'");
    expect(popupResult).toBeTruthy();
  });

  it("should load uBlock Origin from Chrome Web Store by extensionId", async (context) => {
    const testdriver = TestDriver(context, { headless: false, newSandbox: true, cacheKey: 'chrome-extension-id-test' });

    // Launch Chrome with uBlock Origin loaded by its Chrome Web Store ID
    // uBlock Origin ID: cjpalhdlnbpafiamejdnhcphjbkeiagm
    await testdriver.provision.chromeExtension({
      extensionId: 'cjpalhdlnbpafiamejdnhcphjbkeiagm',
      url: 'https://testdriver.ai'
    });

    // Verify Chrome loaded and we can see the page
    const pageResult = await testdriver.assert("the testdriver.ai website is visible");
    expect(pageResult).toBeTruthy();

    // Click on the extensions button (puzzle piece icon) in Chrome toolbar
    const extensionsButton = await testdriver.find("The icon of a puzzle piece in the chrome toolbar. NOT THE BEAKER.");
    await extensionsButton.click();

    // Look for uBlock Origin in the extensions menu
    const uBlockExtension = await testdriver.find("uBlock Origin extension in the extensions dropdown");
    expect(uBlockExtension.found()).toBeTruthy();
  });
});
