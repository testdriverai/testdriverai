/**
 * Notion AI Warning Test
 * Tests that Notion AI shows a warning when attempting to perform calculations
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";
import { loginGoogle } from "./loginGoogle.js";
import { generateRandomString, enterPrompt, verify, validatePromptAppears } from "./helpers.js";

describe("Notion AI should warn on a calculation request", () => {
  it("warns on calculation", async (context) => {
    const randomString = generateRandomString(8);
    const testdriver = TestDriver(context);

    await testdriver.provision.chrome({ url: "https://notion.so/ai" });

    await loginGoogle(testdriver);

    await enterPrompt(testdriver, `what is 2+2 ${randomString}`, { fieldHint: "Ask, search, or make anything" });

    await verify(testdriver, 'Behavioral Activity Warning', { timeout: 60000 });

    await validatePromptAppears(randomString, { expected: "nonBlank" });
  });
});