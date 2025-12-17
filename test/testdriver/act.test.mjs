/**
 * TestDriver SDK - Act Test (Vitest)
 * Tests the AI exploratory loop (act) functionality
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";

describe("Act Test", () => {
  it("should use act to search for testdriver on Google", async (context) => {
    const testdriver = TestDriver(context, { newSandbox: true });
    
    // provision.chrome() automatically calls ready() and starts dashcam
    await testdriver.provision.chrome({
      url: 'https://www.google.com',
    });

    // Use act to search for testdriver
    let actRes = await testdriver.act("click on the empty search box, type 'testdriver', and hit enter. do not click the plus button in the search bar");

    console.log("Act response:", actRes);

    // Assert the search results are displayed
    const result = await testdriver.assert(
      "search results for testdriver are visible",
    );

    expect(result).toBeTruthy();
  });
});
