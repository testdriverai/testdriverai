import { describe, expect, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";
import { getDefaults } from "../examples/config.mjs";

describe("Exec Log Streaming", () => {
  it("should stream exec logs every second for 20 seconds", async (context) => {
    const testdriver = TestDriver(context, { ...getDefaults(context), headless: true });
    await testdriver.provision.chrome({ url: "about:blank" });

    const code = `for i in $(seq 1 20); do echo "log line $i at $(date +%T)"; sleep 1; done`;

    const result = await testdriver.exec({
      language: "sh",
      code,
      timeout: 30000,
    });

    console.log("exec result:", result);

    // Verify we got all 20 log lines
    for (let i = 1; i <= 20; i++) {
      expect(result).toContain(`log line ${i}`);
    }
  });
});
