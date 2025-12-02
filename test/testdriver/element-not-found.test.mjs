/**
 * TestDriver SDK - Element Not Found Test
 * Tests that finding a non-existent element returns properly without timing out
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";

describe("Element Not Found Test", () => {
  it("should handle non-existent element gracefully without timing out", async (context) => {
    const testdriver = TestDriver(context, { headless: true });
    await testdriver.provision.chrome({ url: 'http://testdriver-sandbox.vercel.app/login' });

    //

    // Try to find an element that definitely doesn't exist
    const element = await testdriver.find(
      "a purple unicorn dancing on the moon",
    );

    // Should return an element that is not found
    expect(element.found()).toBe(false);
    expect(element.coordinates).toBeNull();
  }, 90000); // 90 second timeout for the test (should complete much faster)
});
