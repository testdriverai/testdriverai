/**
 * TestDriver SDK - Scroll Until Image Test (Vitest)
 * Converted from: testdriver/acceptance/scroll-until-image.yaml
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";

describe("Scroll Until Image Test", () => {
  it.skip("should scroll until brown colored house image appears", async (context) => {
    const testdriver = TestDriver(context, { ip: context.ip || process.env.TD_IP, headless: true });
    await testdriver.provision.chrome({ url: 'http://testdriver-sandbox.vercel.app/login' });

    //
    // Navigate to Wikipedia page
    await testdriver.pressKeys(["ctrl", "l"]);
    await testdriver.type("https://en.wikipedia.org/wiki/Leonardo_da_Vinci");
    await testdriver.pressKeys(["enter"]);

    // sleep for 5 seconds
    await new Promise((r) => setTimeout(r, 5000));

    // Click on heading
    const heading = await testdriver.find(
      "Leonardo Da Vinci, the page heading",
      0,
    );
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
