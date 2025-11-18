/**
 * TestDriver SDK - Screenshot Test
 * Tests the screenshot() method
 */

import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestClient,
  setupTest,
  teardownTest,
} from "./setup/testHelpers.mjs";

describe("Screenshot Method Test", () => {
  let testdriver;

  beforeAll(async () => {
    testdriver = createTestClient();
    await setupTest(testdriver);
  });

  afterAll(async () => {
    await teardownTest(testdriver);
  });

  it("should capture a screenshot", async () => {
    // Capture a screenshot
    const screenshot = await testdriver.screenshot();

    // Verify it's a base64 string
    expect(screenshot).toBeTruthy();
    expect(typeof screenshot).toBe("string");
    expect(screenshot.length).toBeGreaterThan(0);

    // Verify it's valid base64 by decoding it
    const buffer = Buffer.from(screenshot, "base64");
    expect(buffer.length).toBeGreaterThan(0);

    // Verify it's a valid PNG (starts with PNG signature)
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    expect(buffer.slice(0, 4).equals(pngSignature)).toBeTruthy();
  });

  it("should save screenshot to file", async () => {
    // Capture a screenshot
    const screenshot = await testdriver.screenshot();

    // Save to temp file
    const tempDir = path.join(os.tmpdir(), "testdriver-screenshot-test");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, `test-screenshot-${Date.now()}.png`);
    fs.writeFileSync(filePath, Buffer.from(screenshot, "base64"));

    // Verify file exists and has content
    expect(fs.existsSync(filePath)).toBeTruthy();
    const stats = fs.statSync(filePath);
    expect(stats.size).toBeGreaterThan(0);

    console.log(`Screenshot saved to: ${filePath}`);
  });

  it("should capture screenshot with mouse cursor", async () => {
    // Move mouse to a known location first
    await testdriver.hover(500, 500);

    // Capture with mouse cursor
    const screenshot = await testdriver.screenshot(1, false, true);

    // Verify it's a valid screenshot
    expect(screenshot).toBeTruthy();
    expect(typeof screenshot).toBe("string");

    const buffer = Buffer.from(screenshot, "base64");
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    expect(buffer.slice(0, 4).equals(pngSignature)).toBeTruthy();
  });
});
