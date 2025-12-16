/**
 * TestDriver SDK - Launch VS Code on Linux Test (Vitest)
 * Tests launching Visual Studio Code on Debian/Ubuntu using provision.vscode()
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";

describe("Launch VS Code on Linux", () => {
  it(
    "should launch VS Code on Debian/Ubuntu",
    async (context) => {
      const testdriver = TestDriver(context, { newSandbox: true });
      
      // provision.vscode() automatically calls ready() and starts dashcam
      await testdriver.provision.vscode();

      // Assert that VS Code is running
      const result = await testdriver.assert(
        "Visual Studio Code window is visible on screen",
      );
      expect(result).toBeTruthy();
    },
  );

  it(
    "should install and use a VS Code extension",
    async (context) => {
      const testdriver = TestDriver(context, { newSandbox: true });
      
      // Launch VS Code with the Prettier extension installed
      await testdriver.provision.vscode({
        extensions: ["esbenp.prettier-vscode"],
      });

      // Assert that VS Code is running
      const vsCodeVisible = await testdriver.assert(
        "Visual Studio Code window is visible on screen",
      );
      expect(vsCodeVisible).toBeTruthy();

      // Open the extensions panel to verify Prettier is installed
      await testdriver.pressKeys(["ctrl", "shift", "x"]);
      
      // Wait for extensions panel to open
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Assert that Prettier extension is visible in the installed extensions
      const prettierVisible = await testdriver.assert(
        "Prettier extension is visible in the extensions panel or sidebar",
      );
      expect(prettierVisible).toBeTruthy();
    },
  );
});
