/**
 * TestDriver SDK - Formatted Logging Demo
 * Demonstrates nice Vitest-style formatted logs for Dashcam replay
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";

describe("Formatted Logging Test", () => {
  it("should demonstrate formatted logs in dashcam replay", async (context) => {
    const testdriver = TestDriver(context, { ip: context.ip || process.env.TD_IP, headless: true });
    await testdriver.provision.chrome({ url: 'http://testdriver-sandbox.vercel.app/login' });

    // Find and click - logs will be nicely formatted
    const signInButton = await testdriver.find(
      "Sign In, black button below the password field",
    );
    await signInButton.click();

    // Assert - logs will show pass/fail with nice formatting
    const result = await testdriver.assert(
      "an error shows that fields are required",
    );
    expect(result).toBeTruthy();
  });
});
