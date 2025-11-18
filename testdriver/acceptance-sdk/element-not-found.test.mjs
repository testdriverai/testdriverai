/**
 * TestDriver SDK - Element Not Found Test
 * Tests that finding a non-existent element returns properly without timing out
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestClient,
  setupTest,
  teardownTest,
} from "./setup/testHelpers.mjs";

describe("Element Not Found Test", () => {
  let client;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it("should handle non-existent element gracefully without timing out", async () => {
    await client.focusApplication("Google Chrome");

    // Try to find an element that definitely doesn't exist
    const element = await client.find("a purple unicorn dancing on the moon");

    // Should return an element that is not found
    expect(element.found()).toBe(false);
    expect(element.coordinates).toBeNull();
  }, 90000); // 90 second timeout for the test (should complete much faster)
});
