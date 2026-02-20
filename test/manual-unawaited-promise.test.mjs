/**
 * Manual test to verify unawaited promise detection
 * 
 * Run with: vitest run test/manual-unawaited-promise.test.mjs
 * 
 * Expected: You should see a warning like:
 * ⚠️  Warning: Previous find() may not have been awaited.
 */
import { describe, expect, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";

describe("Unawaited Promise Detection", () => {
  it("should warn when a promise is not awaited", async (context) => {
    const testdriver = TestDriver(context);
    
    await testdriver.provision.chrome({
      url: 'https://example.com',
    });

    // INTENTIONALLY missing await - should trigger warning on next call
    testdriver.find("some button");
    
    // This second call should print a warning about the previous unawaited find()
    const element = await testdriver.find("Example Domain heading");
    
    console.log("Element found:", element.found());
    
    // If we got here without error and saw the warning, the feature works!
    expect(true).toBeTruthy();
  });
});
