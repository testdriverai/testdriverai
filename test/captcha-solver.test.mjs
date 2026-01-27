/**
 * Unit tests for the captcha solver script
 * These tests verify the solver script is valid JavaScript and can be loaded correctly
 */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const solverPath = path.join(__dirname, "..", "lib", "captcha", "solver.js");

describe("Captcha Solver Script", () => {
  it("should exist", () => {
    expect(fs.existsSync(solverPath)).toBe(true);
  });

  it("should be valid JavaScript syntax", () => {
    const script = fs.readFileSync(solverPath, "utf8");

    // This will throw if the syntax is invalid
    expect(() => {
      new vm.Script(script, { filename: "solver.js" });
    }).not.toThrow();
  });

  it("should contain required functions and variables", () => {
    const script = fs.readFileSync(solverPath, "utf8");

    // Check for key components
    expect(script).toContain('require("https")');
    expect(script).toContain('require("chrome-remote-interface")');
    expect(script).toContain("detectCaptchaScript");
    expect(script).toContain("getInjectScript");
    expect(script).toContain("autoSubmitScript");
    expect(script).toContain("checkSuccessScript");
    expect(script).toContain("2captcha.com");
  });

  it("should handle all supported captcha types", () => {
    const script = fs.readFileSync(solverPath, "utf8");

    // Check for captcha type handling
    expect(script).toContain("recaptcha_v2");
    expect(script).toContain("recaptcha_v3");
    expect(script).toContain("hcaptcha");
    expect(script).toContain("turnstile");
  });

  it("should have proper auto-detection for captcha elements", () => {
    const script = fs.readFileSync(solverPath, "utf8");

    // Check for DOM selectors used in auto-detection
    expect(script).toContain(".g-recaptcha[data-sitekey]");
    expect(script).toContain(".h-captcha[data-sitekey]");
    expect(script).toContain(".cf-turnstile[data-sitekey]");
    expect(script).toContain("[data-sitekey]");
  });

  it("should properly inject tokens into response fields", () => {
    const script = fs.readFileSync(solverPath, "utf8");

    // Check for token injection selectors
    expect(script).toContain("[name=g-recaptcha-response]");
    expect(script).toContain("[name=h-captcha-response]");
    expect(script).toContain("[name=cf-turnstile-response]");
    expect(script).toContain("___grecaptcha_cfg");
  });
});
