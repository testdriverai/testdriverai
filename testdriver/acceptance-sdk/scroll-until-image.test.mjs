/**
 * TestDriver SDK - Scroll Until Image Test (Vitest)
 * Converted from: testdriver/acceptance/scroll-until-image.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestClient,
  setupTest,
  teardownTest,
} from "./setup/testHelpers.mjs";

describe("Scroll Until Image Test", () => {
  let testdriver;

  beforeAll(async () => {
    testdriver = createTestClient();
    await setupTest(testdriver);
  });

  afterAll(async () => {
    await teardownTest(testdriver);
  });

  it("should scroll until brown colored house image appears", async () => {
    // Navigate to Wikipedia page
    await testdriver.pressKeys(["ctrl", "l"]);
    await testdriver.type("https://en.wikipedia.org/wiki/Leonardo_da_Vinci");
    await testdriver.pressKeys(["enter"]);

    // Click on heading
    const heading = await testdriver.find("Leonardo Da Vinci, the page heazding");
    await heading.click();

    // Scroll until image appears
    await testdriver.scrollUntilImage("a brown colored house", "down", 10000);

    // Assert image of brown colored house appears on screen
    const result = await testdriver.assert(
      "image of brown colored house appears on screen",
    );
    expect(result).toBeTruthy();
  });
});
