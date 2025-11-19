/**
 * TestDriver SDK - Scroll Until Text Test (Vitest)
 * Converted from: testdriver/acceptance/scroll-until-text.yaml
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestClient,
  performLogin,
  setupTest,
  teardownTest,
} from "./setup/testHelpers.mjs";

describe("Scroll Until Text Test", () => {
  let testdriver;

  beforeAll(async () => {
    testdriver = createTestClient();
    await setupTest(testdriver);
  });

  afterAll(async () => {
    await teardownTest(testdriver);
  });

  it('should scroll until "testdriver socks" appears', async () => {
    // Perform login first
    await performLogin(testdriver);

    // Scroll until text appears
    await testdriver.focusApplication("Google Chrome");
    await testdriver.scrollUntilText("testdriver socks", "down");

    // Assert testdriver socks appears on screen
    await testdriver.focusApplication("Google Chrome");
    const result = await testdriver.assert(
      "TestDriver Socks appears on screen",
    );
    expect(result).toBeTruthy();
  });
});
