/**
 * Example test demonstrating GitHub comment integration
 * 
 * When run in CI with proper environment variables set, this will:
 * 1. Run the tests
 * 2. Record dashcam replays
 * 3. Post a beautiful GitHub comment with results
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";

describe("GitHub Comment Demo", () => {
  it("should pass with dashcam replay", async (context) => {
    const testdriver = TestDriver(context, { headless: true });
    
    await testdriver.provision.chrome({
      url: 'https://www.example.com',
    });

    const heading = await testdriver.find("heading with Example Domain");
    const result = await testdriver.assert("I can see 'Example Domain' heading");
    expect(result).toBeTruthy();
  });

  it("should demonstrate failure handling", async (context) => {
    const testdriver = TestDriver(context, { headless: true });
    
    await testdriver.provision.chrome({
      url: 'https://www.example.com',
    });

    // This will fail intentionally to show error reporting
    const result = await testdriver.assert("I can see a navigation menu with 20 items");
    expect(result).toBeTruthy(); // This will fail
  });

  it("should skip when needed", async (context) => {
    // Skipped tests show in the summary
    context.skip();
  });
});
