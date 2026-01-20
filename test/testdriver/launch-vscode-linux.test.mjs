import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";

const isLinux = (process.env.TD_OS || "linux") === "linux";

describe("Launch VS Code on Linux", () => {
  it.skipIf(!isLinux)(
    "should launch VS Code on Debian/Ubuntu",
    async (context) => {
      const testdriver = TestDriver(context);
      
      // provision.vscode() automatically calls ready() and starts dashcam
      await testdriver.provision.vscode();

      // Wait for VS Code to launch (polls every 5s until found or timeout)
      const vsCodeWindow = await testdriver.find(
        "Visual Studio Code window",
        { timeout: 60000 }
      );
      expect(vsCodeWindow.found()).toBeTruthy();
    },
  );

  it.skipIf(!isLinux)(
    "should install and use a VS Code extension",
    async (context) => {
      const testdriver = TestDriver(context);
      
      // Launch VS Code with the Prettier extension installed
      await testdriver.provision.vscode({
        extensions: ["esbenp.prettier-vscode"],
      });

      const vsCodeWindow = await testdriver.find(
        "Visual Studio Code window",
        { timeout: 60000 }
      );

      expect(vsCodeWindow.found()).toBeTruthy();

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
