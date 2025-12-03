/**
 * TestDriver SDK - Scroll Until Text Test (Vitest)
 * Converted from: testdriver/acceptance/scroll-until-text.yaml
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";
import { performLogin } from "./setup/testHelpers.mjs";

describe("Scroll Until Text Test", () => {
  it('should scroll until "testdriver socks" appears', async (context) => {
    const testdriver = TestDriver(context, { headless: true });
    await testdriver.provision.chrome({ url: 'http://testdriver-sandbox.vercel.app/login' });

    //
    // Perform login first
    await performLogin(testdriver);

    // Scroll until text appears
    await testdriver.focusApplication("Google Chrome");
    await testdriver.scrollUntilText({ text: "testdriver socks", direction: "down" });

    // Assert testdriver socks appears on screen
    await testdriver.focusApplication("Google Chrome");
    const result = await testdriver.assert("TestDriver Socks appears on screen");
    expect(result).toBeTruthy();
  });
});
