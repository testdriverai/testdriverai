/**
 * TestDriver SDK - Installer Test (Vitest)
 * Tests the provision.installer() method for downloading and installing apps
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";

const isLinux = (process.env.TD_OS || "linux") === "linux";

describe("Provision Installer", () => {
  it.skipIf(!isLinux)(
    "should download and install a .deb package on Linux",
    async (context) => {
      const testdriver = TestDriver(context, { ip: context.ip || process.env.TD_IP });
      
      // Install bat (a cat clone with syntax highlighting) using provision.installer
      const filePath = await testdriver.provision.installer({
        url: 'https://github.com/sharkdp/bat/releases/download/v0.24.0/bat_0.24.0_amd64.deb',
      });

      // Verify the file was downloaded
      expect(filePath).toContain('bat');

      // Verify bat was installed by running it
      await testdriver.exec('sh', 'bat --version', 10000);
    },
  );

  it.skipIf(!isLinux)(
    "should download a shell script and verify it exists",
    async (context) => {
      const testdriver = TestDriver(context, { ip: context.ip || process.env.TD_IP });
      
      // Download a shell script (nvm installer)
      const filePath = await testdriver.provision.installer({
        url: 'https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh',
        launch: false, // Don't auto-run the script
      });

      // Verify the file was downloaded
      expect(filePath).toContain('install.sh');

      // Verify the file is executable
      const result = await testdriver.exec('sh', `ls -la "${filePath}"`, 10000);
      expect(result).toBeTruthy();
    },
  );
});
