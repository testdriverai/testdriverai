/**
 * TestDriver Hooks API Demo
 * Demonstrates the new React-style hooks for Vitest
 * 
 * This is the SIMPLEST way to use TestDriver with Vitest!
 */

import { describe, expect, it } from "vitest";
import { useTestDriverWithDashcam } from "../../src/vitest/hooks.mjs";

describe("Hooks API Demo", () => {
  it("should use hooks for automatic lifecycle management", async (context) => {
    // ✨ One line gets you TestDriver + Dashcam with full auto-lifecycle!
    const { client } = useTestDriverWithDashcam(context, { os: 'linux' });
    
    // Everything is automatic:
    // - Sandbox connection ✅
    // - Dashcam auth ✅
    // - Recording start ✅
    // - Recording stop ✅
    // - Cleanup ✅
    
    await client.focusApplication("Google Chrome");

    const signInButton = await client.find(
      "Sign In, black button below the password field",
    );
    await signInButton.click();

    const result = await client.assert(
      "an error shows that fields are required",
    );
    expect(result).toBeTruthy();
    
    // That's it! Dashcam URL automatically registered with the test run
  });
});
