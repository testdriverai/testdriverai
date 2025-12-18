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

import { describe, expect, it } from "vitest";
import { TestDriver } from "../../lib/vitest/hooks.mjs";
const isLinux = (process.env.TD_OS || "linux") === "linux";


describe("Windows App Installation", () => {
  it.skipIf(isLinux)("should download, install, and launch GitButler on Windows", async (context) => {
    // Create TestDriver instance for Windows
    const testdriver = TestDriver(context, { 
      newSandbox: true,
      os: 'windows'
    });

    // Step 1: Download and install GitButler MSI
    const installScript = `
      Write-Host "Starting GitButler installation..."

      # Define variables
      $downloadUrl = "https://app.gitbutler.com/downloads/release/windows/x86_64/msi"
      $installerPath = Join-Path $env:TEMP "gitbutler.msi"
      $installDir = "C:\\Program Files\\GitButler"

      # Download the installer
      Write-Host "Downloading GitButler MSI..."
      Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath

      if (-Not (Test-Path $installerPath)) {
          Write-Error "Download failed. Exiting."
          exit 1
      }

      # Install silently
      Write-Host "Installing GitButler..."
      $installProcess = Start-Process msiexec.exe -ArgumentList "/i \`"$installerPath\`" /qn /norestart" -Wait -PassThru

      if ($installProcess.ExitCode -eq 0) {
          Write-Host "GitButler installed successfully!"
      } else {
          Write-Error "GitButler installation failed with exit code $($installProcess.ExitCode)."
          exit $installProcess.ExitCode
      }

      # Cleanup installer
      if (Test-Path $installerPath) {
          Remove-Item $installerPath -Force
          Write-Host "Cleaned up installer file."
      }

      # Update PATH if not already set
      $envPath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
      if ($envPath -notlike "*$installDir*") {
          Write-Host "Adding GitButler to PATH..."
          $newPath = "$envPath;$installDir"
          [System.Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
          Write-Host "GitButler path added."
      } else {
          Write-Host "GitButler path already in PATH."
      }
    `;

    await testdriver.exec('pwsh', installScript, 120000); // 2 min timeout for download/install

    // Step 2: Clone a sample repository
    const gitSetupScript = `
      # Configure git to avoid interactive prompts
      git config --global core.sshCommand 'ssh -o StrictHostKeyChecking=accept-new'
      git config --global credential.helper manager-core

      Write-Host "Cloning sample repository..."
      git clone --depth 1 https://github.com/testdriverai/gitbutler-remote-sample-repo.git C:\\Users\\testdriver\\Desktop\\gitbutler-remote-sample-repo
    `;

    await testdriver.exec('pwsh', gitSetupScript, 60000);

    // Step 3: Launch GitButler
    const launchScript = `
      $installDir = "C:\\Program Files\\GitButler"
      $exePath = Join-Path $installDir "gitbutler-tauri.exe"

      if (Test-Path $exePath) {
          Write-Host "Launching GitButler..."
          Start-Process $exePath
      } else {
          Write-Error "GitButler executable not found at $exePath. Is it installed?"
          exit 1
      }
    `;

    await testdriver.exec('pwsh', launchScript, 10000);

    // Wait for application to start
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 4: Verify the app launched by finding UI elements
    const appWindow = await testdriver.find("GitButler window or application title");
    expect(appWindow).toBeTruthy();

    // Optional: Assert the app is ready
    const result = await testdriver.assert("GitButler application is open and visible");
    expect(result).toBeTruthy();
  });

  it("should install an MSI package using provision.installer", async (context) => {
    // Alternative approach using provision.installer helper
    const testdriver = TestDriver(context, { 
      newSandbox: true,
      os: 'windows'
    });

    // Download the MSI installer
    const installerPath = await testdriver.provision.installer({
      url: 'https://app.gitbutler.com/downloads/release/windows/x86_64/msi',
      launch: false, // Don't auto-launch, we'll install manually
    });

    expect(installerPath).toContain('.msi');

    // Install the MSI silently
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
