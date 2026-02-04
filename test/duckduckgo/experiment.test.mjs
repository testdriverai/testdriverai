/**
 * Experiment file - reconnects to existing sandbox
 * Run AFTER setup.test.mjs passes
 */
import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";

describe("Experiment DuckDuckGo", () => {
  it("should search for apples", async (context) => {
    const testdriver = TestDriver(context, {
      reconnect: true, // ← Key: reconnects to last sandbox
    });

    // NO provision here! The sandbox is already running from setup.test.mjs

    // Find search input and type
    const searchInput = await testdriver.find("search input");
    await searchInput.click();
    await testdriver.type("apples");
    await testdriver.pressKeys(["enter"]);

    // Assert results
    const result = await testdriver.assert(
      "I can see search results for apples",
    );
    expect(result).toBeTruthy();
  });
});
