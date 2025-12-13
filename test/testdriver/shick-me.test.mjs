/**
 * TestDriver SDK - Shick.me Website Test (Vitest)
 * Tests the shick.me personal website
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";

describe("Shick.me Website Test", () => {
  it("should load the shick.me website successfully", async (context) => {
    const testdriver = TestDriver(context, {
      headless: true,
      newSandbox: true,
      cacheKey: 'shick-me-test'
    });

    await testdriver.provision.chrome({ url: 'https://shick.me/' });

    // Assert that the page loaded successfully
    const result = await testdriver.assert(
      "the page has loaded and displays content",
    );
    expect(result).toBeTruthy();
  });

  it("should have a visible heading or title", async (context) => {
    const testdriver = TestDriver(context, {
      headless: true,
      newSandbox: true,
      cacheKey: 'shick-me-heading-test'
    });

    await testdriver.provision.chrome({ url: 'https://shick.me/' });

    // Assert that there is a heading or title visible
    const result = await testdriver.assert(
      "there is a heading or title visible on the page",
    );
    expect(result).toBeTruthy();
  });

  it("should be able to interact with the page", async (context) => {
    const testdriver = TestDriver(context, {
      headless: true,
      newSandbox: true,
      cacheKey: 'shick-me-interaction-test'
    });

    await testdriver.provision.chrome({ url: 'https://shick.me/' });

    // Try to scroll on the page
    await testdriver.scroll({ direction: "down", amount: 200 });

    // Assert that scrolling worked
    const result = await testdriver.assert(
      "the page has scrolled down",
    );
    expect(result).toBeTruthy();
  });
});
