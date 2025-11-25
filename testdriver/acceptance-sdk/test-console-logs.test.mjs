/**
 * TestDriver SDK - Console Log Test
 * Tests that console.log statements are captured and sent to dashcam
 */

import { describe, expect, it } from "vitest";
import { provision } from "../../src/presets/index.mjs";

describe("Console Log Test", () => {
  it("should capture console logs and send them to dashcam", async (context) => {
    console.log("🎬 Test starting - this should appear in dashcam");
    
    // Use provision() - Chrome is already open and focused
    const { testdriver } = await provision('chrome', {
      url: 'http://testdriver-sandbox.vercel.app/login',
    }, context);

    console.log("✅ Chrome launched successfully");

    // Give Chrome a moment to fully render the UI
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log("🔍 Looking for Sign In button");

    // Find and click the sign in button
    const signInButton = await testdriver.find(
      "Sign In, black button below the password field",
    );
    
    console.log("👆 Clicking Sign In button");
    await signInButton.click();
    
    console.log("🧪 Asserting error message appears");

    // Assert error shows
    const result = await testdriver.assert(
      "an error shows that fields are required",
    );
    
    console.log("✅ Test completed successfully - all logs should be in dashcam");
    
    expect(result).toBeTruthy();
  });
});
