/**
 * TestDriver SDK - Idle 10 Minute Test (Vitest)
 *
 * Spawns a VM, opens testdriver.ai, waits 10 minutes, then asserts that
 * testdriver.ai is still visible on screen. Verifies the sandbox and session
 * stay alive during a long idle period.
 *
 * Runs on both Linux and Windows acceptance suites (Windows via TD_OS=windows).
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../lib/vitest/hooks.mjs";
import { getDefaults } from "../examples/config.mjs";

const DELAY = 10 * 60 * 1000;

describe("Idle 10 Minute Test", () => {
  it(
    "should keep testdriver.ai visible after idling for 10 minutes",
    { timeout: DELAY + 5 * 60 * 1000 },
    async (context) => {
      const testdriver = TestDriver(context, {
        ...getDefaults(context),
      });

      // Spawn the VM and open testdriver.ai
      await testdriver.provision.chrome({
        url: "https://testdriver.ai",
      });

      // Idle for 10 minutes
      await testdriver.wait(DELAY);

      // Assert testdriver.ai is still visible on screen
      const result = await testdriver.assert(
        "the testdriver.ai website is visible on the screen",
      );

      expect(result).toBeTruthy();
    },
  );
});
