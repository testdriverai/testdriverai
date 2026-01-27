/**
 * Test for testdriver.captcha() API
 * Clean, simple API for solving captchas
 */
import { describe, expect, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";

console.log("DEBUG: process.env.TD_OS:", process.env.TD_OS);

describe("testdriver.captcha() API", () => {
  it("should solve reCAPTCHA v3 with auto-detect", async (context) => {
    const testdriver = TestDriver(context);

    // Launch Chrome (remote debugging is enabled automatically on Linux)
    await testdriver.provision.chrome({
      url: "https://2captcha.com/demo/recaptcha-v3",
    });

    await testdriver.screenshot();

    // Solve the captcha with just the API key - everything else is auto-detected!
    const result = await testdriver.captcha({
      apiKey: process.env.TWOCAPTCHA_API_KEY,
    });

    console.log("Captcha result:", result);
    await testdriver.screenshot();

    expect(result.success).toBe(true);
  }, 180000);

  it("should solve Cloudflare Turnstile", async (context) => {
    const testdriver = TestDriver(context);

    await testdriver.provision.chrome({
      url: "https://2captcha.com/demo/cloudflare-turnstile",
    });

    await testdriver.screenshot();

    const result = await testdriver.captcha({
      apiKey: process.env.TWOCAPTCHA_API_KEY,
    });

    console.log("Turnstile result:", result);
    await testdriver.screenshot();

    expect(result.success).toBe(true);
  }, 180000);
});
