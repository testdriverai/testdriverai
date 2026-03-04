/**
 * Ably Migration Smoke Test
 * Tests sandbox provisioning via Ably channels with custom AMI
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";
import { getDefaults } from "./config.mjs";
import fs from "fs";

describe("Ably Smoke Test", () => {
  it("should provision sandbox via Ably and assert page loads", async (context) => {
    const testdriver = TestDriver(context, {
      ...getDefaults(context),
      os: 'windows',
      sandboxAmi: process.env.TD_SANDBOX_AMI || "ami-0942c6cf5bd2eba12",
    });
    
    // provision.chrome() calls ready() internally, connects via Ably
    await testdriver.provision.chrome({
      url: 'http://testdriver-sandbox.vercel.app/login',
    });

    // Take a screenshot to verify sandbox is alive
    // This exercises the full Ably round-trip: SDK -> runner -> S3 -> SDK
    await testdriver.screenshot();

    // Verify the screenshot file was created and has real image data
    const screenshotDir = ".testdriver/screenshots/ably-smoke.test";
    const files = fs.existsSync(screenshotDir) ? fs.readdirSync(screenshotDir) : [];
    expect(files.length).toBeGreaterThan(0);

    const latestScreenshot = files[files.length - 1];
    const screenshotPath = `${screenshotDir}/${latestScreenshot}`;
    const stats = fs.statSync(screenshotPath);
    // A real screenshot should be at least 10KB
    expect(stats.size).toBeGreaterThan(10000);
  });
});
