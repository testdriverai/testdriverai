/**
 * TestDriver SDK - Chrome Extension Test (Vitest)
 * Tests loading a Chrome extension using provision.chromeExtension()
 * 
 * This test suite covers:
 * 1. Loading extension from local path (extensionPath)
 * 2. Loading extension from Chrome Web Store (extensionId)
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";

describe("Chrome Extension Test", () => {
  it("should load hello-world Chrome extension from local path", async (context) => {

    console.log('connecting to', process.env.TD_IP)

    const testdriver = TestDriver(context, { ip: context.ip || process.env.TD_IP, cacheKey: new Date().getTime().toString() });
    
    // Wait for connection to be ready before running exec
    await testdriver.ready();
    
    // Determine OS-specific paths and commands
    const shell = testdriver.os === 'windows' ? 'pwsh' : 'sh';
    const extensionsDir = testdriver.os === 'windows' 
      ? 'C:\\Users\\testdriver\\Downloads\\chrome-extensions-samples'
      : '/tmp/chrome-extensions-samples';
    const extensionPath = testdriver.os === 'windows'
      ? `${extensionsDir}\\functional-samples\\tutorial.hello-world`
      : `${extensionsDir}/functional-samples/tutorial.hello-world`;
    
    // Clone the Chrome extensions samples repo
    const cloneCmd = testdriver.os === 'windows'
      ? `git clone --depth 1 https://github.com/GoogleChrome/chrome-extensions-samples.git "${extensionsDir}"`
      : `git clone --depth 1 https://github.com/GoogleChrome/chrome-extensions-samples.git ${extensionsDir}`;
    
    await testdriver.exec(shell, cloneCmd, 60000, true);

    // Launch Chrome with the hello-world extension loaded
    await testdriver.provision.chromeExtension({
      extensionPath: extensionPath
    });

    // Navigate to testdriver.ai (extensions don't load on New Tab)
    const addressBar = await testdriver.find("Chrome address bar");
    await addressBar.click();
    await testdriver.type("testdriver.ai");
    await testdriver.pressKeys(["enter"]);

    // Wait for page to load
    const pageResult = await testdriver.assert("I can see testdriver.ai");
    expect(pageResult).toBeTruthy();

    // The hello-world extension adds a puzzle piece icon to the toolbar
    // When clicked, it shows a popup with "Hello Extensions"

    // Click on the extensions button (puzzle piece icon) in Chrome toolbar
    const extensionsButton = await testdriver.find("The extensions button in the Chrome toolbar", {zoom: true});
    await extensionsButton.click();

    // Look for the hello world extension in the extensions menu
    const helloExtension = await testdriver.find("Hello Extensions extension in the extensions dropdown");
    await helloExtension.click();

    // Verify the extension popup shows "Hello Extensions" text
    const popupResult = await testdriver.assert("a popup shows with the text 'Hello Extensions'");
    expect(popupResult).toBeTruthy();
  });

  it("should load Loom from Chrome Web Store by extensionId", async (context) => {
    const testdriver = TestDriver(context, { ip: context.ip || process.env.TD_IP });

    // Launch Chrome with Loom loaded by its Chrome Web Store ID
    // Loom ID: liecbddmkiiihnedobmlmillhodjkdmb
    await testdriver.provision.chromeExtension({
      extensionId: 'liecbddmkiiihnedobmlmillhodjkdmb'
    });

    // Navigate to testdriver.ai (extensions don't load on New Tab)
    const addressBar = await testdriver.find("Chrome address bar");
    await addressBar.click();
    await testdriver.type("testdriver.ai");
    await testdriver.pressKeys(["enter"]);

    // Wait for page to load
    const pageResult = await testdriver.assert("I can see testdriver.ai");
    expect(pageResult).toBeTruthy();

    // Click on the extensions button (puzzle piece icon) in Chrome toolbar
    const extensionsButton = await testdriver.find("The puzzle-shaped icon in the Chrome toolbar.", {zoom: true});
    await extensionsButton.click();

    // Look for Loom in the extensions menu
    const loomExtension = await testdriver.find("Loom extension in the extensions dropdown");
    expect(loomExtension.found()).toBeTruthy();
  });
});
