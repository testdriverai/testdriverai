/**
 * Setup file - MINIMAL steps to get to starting state
 * Only add more steps AFTER this passes!
 */
import { afterAll, describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";

describe("Setup DuckDuckGo", () => {
  afterAll(async () => {
    // DO NOT disconnect - keep sandbox alive for reconnect
    console.log("Sandbox staying alive for 30 seconds (keepAlive)");
  });

  it("should set up the application state", async (context) => {
    const testdriver = TestDriver(context);

    await testdriver.provision.chrome({
      url: "https://duckduckgo.com",
    });

    // Start with just ONE assertion to verify we're on the right page
    const result = await testdriver.assert(
      "I can see the DuckDuckGo search page",
    );
    expect(result).toBeTruthy();

    console.log("✅ Setup ready - run experiment.test.mjs now");
  });
});
