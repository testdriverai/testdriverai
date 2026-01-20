/**
 * TestDriver SDK - Scroll Until Text Test (Vitest)
 * Converted from: testdriver/acceptance/scroll-until-text.yaml
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";

/**
 * Perform login flow for SauceLabs demo app
 * @param {TestDriver} client - TestDriver client
 * @param {string} username - Username (default: 'standard_user')
 */
async function performLogin(client, username = "standard_user") {
  await client.focusApplication("Google Chrome");
  const password = await client.extract("the password");
  const usernameField = await client.find(
    "username input",
  );
  await usernameField.click();
  await client.type(username);
  await client.pressKeys(["tab"]);
  await client.type(password, { secret: true });
  await client.pressKeys(["tab"]);
  await client.pressKeys(["enter"]);
}

describe("Scroll Until Text Test", () => {
  it('should scroll until "testdriver socks" appears', async (context) => {
    const testdriver = TestDriver(context, { ip: context.ip || process.env.TD_IP, headless: true });
    await testdriver.provision.chrome({ url: 'http://testdriver-sandbox.vercel.app/login' });

    //
    // Perform login first
    await performLogin(testdriver);

    // Scroll until text appears
    await testdriver.focusApplication("Google Chrome");

    await testdriver.find('TestDriver.ai Sandbox heading').click();

    // Scroll until text appears
    let found = false;
    let scrollCount = 0;
    const maxScrolls = 10;
    
    while (!found && scrollCount < maxScrolls) {
      const findResult = await testdriver.find("testdriver socks product text is fully visible");

      if (findResult.found()) {
        found = true;
      } else {
        await testdriver.scroll();
        scrollCount++;
      }
    }
    
    if (!found) {
      throw new Error(`Failed to find "testdriver socks" after ${maxScrolls} scrolls`);
    }

    // Assert testdriver socks appears on screen
    await testdriver.focusApplication("Google Chrome");
    const result = await testdriver.assert("TestDriver Socks appears on screen");
    expect(result).toBeTruthy();
  });
});
