/**
 * TestDriver SDK - Windows Installer Example (Vitest)
 * 
 * This example demonstrates how to download and install a Windows application
 * using PowerShell commands, then launch and interact with it.
 * 
 * Based on the v6 GitButler provisioning workflow.
 * 
 * Run: TD_OS=windows npx vitest run examples/windows-installer.test.mjs
 */

import { describe, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";

const isLinux = (process.env.TD_OS || "linux") === "linux";

describe("Windows App Installation", () => {
    
  it.skipIf(isLinux)("should download, install, and launch GitButler on Windows", async (context) => {
    // Alternative approach using provision.installer helper
    const testdriver = TestDriver(context, { 
      ip: context.ip || process.env.TD_IP,
      os: 'windows'
    });

    // Download the MSI installer
    const installerPath = await testdriver.provision.installer({
      url: 'https://app.gitbutler.com/downloads/release/windows/x86_64/msi',
      launch: false, // Don't auto-launch, we'll install manually
    });

    console.log('Installer downloaded to:', installerPath);

    // Install the MSI silently (the file might not have an extension, so we try MSI first)
    await testdriver.exec('pwsh', 
      `Start-Process msiexec.exe -ArgumentList "/i \`"${installerPath}\`" /qn /norestart" -Wait`,
      120000
    );

    // Verify installation by checking if executable exists
    const verifyScript = `
      $exePath = "C:\\Program Files\\GitButler\\gitbutler-tauri.exe"
      if (Test-Path $exePath) {
          Write-Host "GitButler installed successfully at $exePath"
      } else {
          Write-Error "GitButler not found"
          exit 1
      }
    `;

    await testdriver.exec('pwsh', verifyScript, 5000);
  });
});
