/**
 * TestDriver SDK - AI Test (Vitest)
 * Tests the AI exploratory loop (ai) functionality
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";

describe("AI Test", () => {
  it("should use ai to search for testdriver on Google", async (context) => {
    const testdriver = TestDriver(context);
    
    // provision.chrome() automatically calls ready() and starts dashcam
    await testdriver.provision.chrome({
      url: 'https://duckduckgo.com',
    });

    // Use ai to search for testdriver
    let aiRes = await testdriver.ai("click on the empty search box, type 'testdriver', and hit enter.");

    console.log("AI response:", aiRes);

    // Assert the search results are displayed
    const result = await testdriver.assert(
      "search results for testdriver are visible",
    );

    expect(result).toBeTruthy();
  });
});
