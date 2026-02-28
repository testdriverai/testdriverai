import { describe, expect, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";
import { getDefaults } from "./config.mjs";

describe("Exec Test - No Chrome", () => {
  it("should execute shell commands via presence runner", async (context) => {
    const testdriver = TestDriver(context, {
      ...getDefaults(context),
      preview: "none",
      dashcam: false,
    });

    // Just connect to sandbox - don't provision Chrome
    await testdriver.ready();

    // Test basic exec
    const whoami = await testdriver.exec("sh", "whoami", 10000);
    console.log("whoami result:", whoami);
    expect(whoami).toBeTruthy();

    // Test pwd
    const pwd = await testdriver.exec("sh", "pwd", 10000);
    console.log("pwd result:", pwd);
    expect(pwd).toBeTruthy();

    // Test echo
    const echo = await testdriver.exec("sh", "echo 'Hello from presence runner!'", 10000);
    console.log("echo result:", echo);
    expect(echo).toContain("Hello");

    // Test multiple commands
    const multi = await testdriver.exec("sh", "date && hostname", 10000);
    console.log("multi result:", multi);
    expect(multi).toBeTruthy();

    console.log("✅ All exec tests passed!");
  });
});
