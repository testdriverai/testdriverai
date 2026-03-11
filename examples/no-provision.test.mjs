/**
 * TestDriver SDK - No-Provision Test with Dashcam (Vitest)
 * 
 * Demonstrates manual dashcam control without using provision methods.
 * When not using provision.chrome(), provision.vscode(), etc., you need
 * to manually start and stop dashcam recording.
 */

import { describe, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";
import { getDefaults } from "./config.mjs";

describe("No-Provision with Dashcam", () => {
  it("should record dashcam while asserting desktop is visible", async (context) => {
    const testdriver = TestDriver(context, { ...getDefaults(context) });

    // Start dashcam recording manually (provision methods do this automatically)
    await testdriver.dashcam.start();
    
    await testdriver.exec('sh', 'gedit >/dev/null 2>&1 &'); // Example command to keep the test running for a bit

    await testdriver.assert('untitled document is visible');

    // Stop dashcam and get the recording URL
    const dashcamUrl = await testdriver.dashcam.stop();
    if (dashcamUrl) {
      console.log(`🎥 Dashcam recording: ${dashcamUrl}`);
    }
  });
});

