/**
 * TestDriver SDK - Focus Window Test (Vitest)
 * Converted from: testdriver/acceptance/focus-window.yaml
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTestClient,
  setupTest,
  teardownTest,
} from "./setup/testHelpers.mjs";

describe("Focus Window Test", () => {
  let testdriver;

  beforeEach(async (context) => {
    testdriver = createTestClient({ task: context.task });
    
    
    await setupTest(testdriver);
  });

  afterEach(async (context) => {
    await teardownTest(testdriver, { task: context.task });
  });

  it.skipIf(() => testdriver.os === "linux")("should click Microsoft Edge icon and focus Google Chrome", async () => {
    // Show desktop
    await testdriver.pressKeys(["winleft", "d"]);

    // Click on the Microsoft Edge icon
    const edgeIcon = await testdriver.find(
      "a blue and green swirl icon on the taskbar representing Microsoft Edge",
    );
    await edgeIcon.click();

    // Focus Google Chrome
    await testdriver.focusApplication("Google Chrome");

    // Assert Chrome is focused (implicit through successful focus)
    const result = await testdriver.assert(
      "Google Chrome is the focused application",
    );
    expect(result).toBeTruthy();
  });
});
