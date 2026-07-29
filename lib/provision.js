/**
 * Provision API for the TestDriver SDK.
 *
 * Exposes methods for launching applications (chrome, chromeExtension, vscode,
 * installer, electron) and initializing dashcam recording inside the sandbox.
 *
 * All methods are wrapped with a Proxy that skips provisioning when the SDK
 * is in reconnect mode.
 */

/**
 * Create the provision API bound to a TestDriver SDK instance.
 *
 * @param {object} self - The TestDriver instance. Provision methods read from
 *   `self.os`, `self.dashcam`, `self.dashcamEnabled`, `self.reconnect`, and
 *   call through `self.exec(...)`, `self.focusApplication(...)`,
 *   `self._getDashcamChromeExtensionPath()`, `self._waitForChromeDebuggerReady()`,
 *   and `self._getUrlDomainPattern(url)`.
 * @returns {Proxy} The provision API object.
 */
function createProvisionAPI(self) {
  const provisionMethods = {
    /**
     * Launch Chrome browser
     * @param {Object} options - Chrome launch options
     * @param {string} [options.url='http://testdriver-sandbox.vercel.app/'] - URL to navigate to
     * @param {boolean} [options.maximized=true] - Start maximized
     * @param {boolean} [options.guest=false] - Use guest mode
     * @returns {Promise<void>}
     */
    chrome: async (options = {}) => {
      const {
        url = "http://testdriver-sandbox.vercel.app/",
        maximized = true,
        guest = false,
      } = options;

      // Store the URL for domain-specific web log tracking
      self._provisionedChromeUrl = url;

      // Set up Chrome profile with preferences
      const shell = self.os === "windows" ? "pwsh" : "sh";
      const userDataDir =
        self.os === "windows"
          ? "C:\\Users\\testdriver\\AppData\\Local\\TestDriver\\Chrome"
          : "/tmp/testdriver-chrome-profile";

      // Create user data directory and Default profile directory
      const defaultProfileDir =
        self.os === "windows"
          ? `${userDataDir}\\Default`
          : `${userDataDir}/Default`;

      const createDirCmd =
        self.os === "windows"
          ? `New-Item -ItemType Directory -Path "${defaultProfileDir}" -Force | Out-Null`
          : `mkdir -p "${defaultProfileDir}"`;

      await self.exec(shell, createDirCmd, 60000, true);

      // Write Chrome preferences
      const chromePrefs = {
        credentials_enable_service: false,
        profile: {
          password_manager_enabled: false,
          default_content_setting_values: {},
        },
        signin: {
          allowed: false,
        },
        sync: {
          requested: false,
          first_setup_complete: true,
          sync_all_os_types: false,
        },
        autofill: {
          enabled: false,
        },
        local_state: {
          browser: {
            has_seen_welcome_page: true,
          },
        },
      };

      const prefsPath =
        self.os === "windows"
          ? `${defaultProfileDir}\\Preferences`
          : `${defaultProfileDir}/Preferences`;

      const prefsJson = JSON.stringify(chromePrefs, null, 2);
      const writePrefCmd =
        self.os === "windows"
          ? // Use compact JSON and [System.IO.File]::WriteAllText to avoid Set-Content hanging issues
            `[System.IO.File]::WriteAllText("${prefsPath}", '${JSON.stringify(chromePrefs).replace(/'/g, "''")}')`
          : `cat > "${prefsPath}" << 'EOF'\n${prefsJson}\nEOF`;

      await self.exec(shell, writePrefCmd, 60000, true);

      // Build Chrome launch command
      const chromeArgs = [];
      if (maximized) chromeArgs.push("--start-maximized");
      if (guest) chromeArgs.push("--guest");
      chromeArgs.push(
        "--disable-fre",
        "--no-default-browser-check",
        "--no-first-run",
        "--no-experiments",
        "--disable-infobars",
        "--disable-features=StartupBrowserCreator",
        "--disable-features=ChromeWhatsNewUI",
        `--user-data-dir=${userDataDir}`,
      );

      // Add remote debugging port for captcha solving support
      chromeArgs.push("--remote-debugging-port=9222");

      // Add dashcam-chrome extension
      const dashcamChromePath = await self._getDashcamChromeExtensionPath();
      if (dashcamChromePath) {
        chromeArgs.push(`--load-extension=${dashcamChromePath}`);
      }

      // Launch Chrome

      if (self.os === "windows") {
        const argsString = chromeArgs.map((arg) => `"${arg}"`).join(", ");
        await self.exec(
          shell,
          `Start-Process "C:\\ChromeForTesting\\chrome-win64\\chrome.exe" -ArgumentList ${argsString}, "${url}"`,
          30000,
        );
      } else {
        const argsString = chromeArgs.join(" ");
        await self.exec(
          shell,
          `chrome-for-testing ${argsString} "${url}" >/dev/null 2>&1 &`,
          30000,
        );
      }

      // Wait for Chrome debugger port and page to be ready
      await self._waitForChromeDebuggerReady();
      await self.focusApplication("Google Chrome");

      // Add web log tracking with domain wildcard pattern, then start dashcam
      if (self.dashcamEnabled) {
        const domainPattern = self._getUrlDomainPattern(url);
        await self.dashcam.addWebLog(domainPattern, "Web Logs");

        // Start dashcam recording after logs are configured
        if (!(await self.dashcam.isRecording())) {
          await self.dashcam.start();
        }
      }
    },

    /**
     * Launch Chrome browser with a custom extension loaded
     * @param {Object} options - Chrome extension launch options
     * @param {string} [options.extensionPath] - Local filesystem path to the unpacked extension directory
     * @param {string} [options.extensionId] - Chrome Web Store extension ID (e.g., "cjpalhdlnbpafiamejdnhcphjbkeiagm" for uBlock Origin)
     * @param {boolean} [options.maximized=true] - Start maximized
     * @returns {Promise<void>}
     * @example
     * // Load extension from local path
     * await testdriver.exec('sh', 'git clone https://github.com/user/extension.git /tmp/extension');
     * await testdriver.provision.chromeExtension({
     *   extensionPath: '/tmp/extension'
     * });
     *
     * @example
     * // Load extension by Chrome Web Store ID
     * await testdriver.provision.chromeExtension({
     *   extensionId: 'cjpalhdlnbpafiamejdnhcphjbkeiagm' // uBlock Origin
     * });
     */
    chromeExtension: async (options = {}) => {
      const {
        extensionPath: providedExtensionPath,
        extensionId,
        maximized = true,
      } = options;

      if (!providedExtensionPath && !extensionId) {
        throw new Error(
          "[provision.chromeExtension] Either extensionPath or extensionId is required",
        );
      }

      let extensionPath = providedExtensionPath;
      const shell = self.os === "windows" ? "pwsh" : "sh";

      // If extensionId is provided, download and extract the extension from Chrome Web Store
      if (extensionId && !extensionPath) {
        console.log(
          `[provision.chromeExtension] Downloading extension ${extensionId} from Chrome Web Store...`,
        );

        const extensionDir =
          self.os === "windows"
            ? `C:\\Users\\testdriver\\AppData\\Local\\TestDriver\\Extensions\\${extensionId}`
            : `/tmp/testdriver-extensions/${extensionId}`;

        // Create extension directory
        const mkdirCmd =
          self.os === "windows"
            ? `New-Item -ItemType Directory -Path "${extensionDir}" -Force | Out-Null`
            : `mkdir -p "${extensionDir}"`;
        await self.exec(shell, mkdirCmd, 60000, true);

        // Download CRX from Chrome Web Store
        // The CRX download URL format for Chrome Web Store
        const crxUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=131.0.0.0&acceptformat=crx2,crx3&x=id%3D${extensionId}%26installsource%3Dondemand%26uc`;
        const crxPath =
          self.os === "windows"
            ? `${extensionDir}\\extension.crx`
            : `${extensionDir}/extension.crx`;

        if (self.os === "windows") {
          await self.exec(
            "pwsh",
            `Invoke-WebRequest -Uri "${crxUrl}" -OutFile "${crxPath}"`,
            60000,
            true,
          );
        } else {
          await self.exec(
            "sh",
            `curl -L -o "${crxPath}" "${crxUrl}"`,
            60000,
            true,
          );
        }

        // Extract the CRX file (CRX is a ZIP with a header)
        // Skip the CRX header and extract as ZIP
        if (self.os === "windows") {
          // PowerShell: Read CRX, skip header, extract ZIP
          await self.exec(
            "pwsh",
            `
$crxBytes = [System.IO.File]::ReadAllBytes("${crxPath}")
# CRX3 header: 4 bytes magic + 4 bytes version + 4 bytes header length + header
$magic = [System.Text.Encoding]::ASCII.GetString($crxBytes[0..3])
if ($magic -eq "Cr24") {
  $headerLen = [BitConverter]::ToUInt32($crxBytes, 8)
  $zipStart = 12 + $headerLen
} else {
  # CRX2 format
  $zipStart = 16 + [BitConverter]::ToUInt32($crxBytes, 8) + [BitConverter]::ToUInt32($crxBytes, 12)
}
$zipBytes = $crxBytes[$zipStart..($crxBytes.Length - 1)]
$zipPath = "${extensionDir}\\extension.zip"
[System.IO.File]::WriteAllBytes($zipPath, $zipBytes)
Expand-Archive -Path $zipPath -DestinationPath "${extensionDir}\\unpacked" -Force
              `,
            30000,
            true,
          );
          extensionPath = `${extensionDir}\\unpacked`;
        } else {
          // Linux: Use unzip with offset or python to extract
          await self.exec(
            "sh",
            `
cd "${extensionDir}"
# Extract CRX (skip header and unzip)
# CRX3 format: magic(4) + version(4) + header_length(4) + header + zip
python3 -c "
import struct
import zipfile
import io
import os

with open('extension.crx', 'rb') as f:
    data = f.read()

# Check magic number
magic = data[:4]
if magic == b'Cr24':
    # CRX3 format
    header_len = struct.unpack('<I', data[8:12])[0]
    zip_start = 12 + header_len
else:
    # CRX2 format  
    pub_key_len = struct.unpack('<I', data[8:12])[0]
    sig_len = struct.unpack('<I', data[12:16])[0]
    zip_start = 16 + pub_key_len + sig_len

zip_data = data[zip_start:]
os.makedirs('unpacked', exist_ok=True)
with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
    zf.extractall('unpacked')
"
              `,
            30000,
            true,
          );
          extensionPath = `${extensionDir}/unpacked`;
        }

        console.log(
          `[provision.chromeExtension] Extension ${extensionId} extracted to ${extensionPath}`,
        );
      }

      // Set up Chrome profile with preferences
      const userDataDir =
        self.os === "windows"
          ? "C:\\Users\\testdriver\\AppData\\Local\\TestDriver\\Chrome"
          : "/tmp/testdriver-chrome-profile";

      // Create user data directory and Default profile directory
      const defaultProfileDir =
        self.os === "windows"
          ? `${userDataDir}\\Default`
          : `${userDataDir}/Default`;

      const createDirCmd =
        self.os === "windows"
          ? `New-Item -ItemType Directory -Path "${defaultProfileDir}" -Force | Out-Null`
          : `mkdir -p "${defaultProfileDir}"`;

      await self.exec(shell, createDirCmd, 60000, true);

      // Write Chrome preferences
      const chromePrefs = {
        credentials_enable_service: false,
        profile: {
          password_manager_enabled: false,
          default_content_setting_values: {},
        },
        signin: {
          allowed: false,
        },
        sync: {
          requested: false,
          first_setup_complete: true,
          sync_all_os_types: false,
        },
        autofill: {
          enabled: false,
        },
        local_state: {
          browser: {
            has_seen_welcome_page: true,
          },
        },
      };

      const prefsPath =
        self.os === "windows"
          ? `${defaultProfileDir}\\Preferences`
          : `${defaultProfileDir}/Preferences`;

      const prefsJson = JSON.stringify(chromePrefs, null, 2);
      const writePrefCmd =
        self.os === "windows"
          ? // Use compact JSON and [System.IO.File]::WriteAllText to avoid Set-Content hanging issues
            `[System.IO.File]::WriteAllText("${prefsPath}", '${JSON.stringify(chromePrefs).replace(/'/g, "''")}')`
          : `cat > "${prefsPath}" << 'EOF'\n${prefsJson}\nEOF`;

      await self.exec(shell, writePrefCmd, 60000, true);

      // Build Chrome launch command
      const chromeArgs = [];
      if (maximized) chromeArgs.push("--start-maximized");
      chromeArgs.push(
        "--disable-fre",
        "--no-default-browser-check",
        "--no-first-run",
        "--no-experiments",
        "--disable-infobars",
        "--disable-features=ChromeLabs",
        `--user-data-dir=${userDataDir}`,
      );

      // Add remote debugging port for captcha solving support
      chromeArgs.push("--remote-debugging-port=9222");

      // Add user extension and dashcam-chrome extension
      const dashcamChromePath = await self._getDashcamChromeExtensionPath();
      if (dashcamChromePath) {
        // Load both user extension and dashcam-chrome for web log capture
        chromeArgs.push(
          `--load-extension=${extensionPath},${dashcamChromePath}`,
        );
      } else {
        // If dashcam-chrome unavailable, just load user extension
        chromeArgs.push(`--load-extension=${extensionPath}`);
      }

      // Launch Chrome (opens to New Tab by default)
      if (self.os === "windows") {
        const argsString = chromeArgs.map((arg) => `"${arg}"`).join(", ");
        await self.exec(
          shell,
          `Start-Process "C:\\ChromeForTesting\\chrome-win64\\chrome.exe" -ArgumentList ${argsString}`,
          30000,
        );
      } else {
        const argsString = chromeArgs.join(" ");
        await self.exec(
          shell,
          `chrome-for-testing ${argsString} >/dev/null 2>&1 &`,
          30000,
        );
      }

      // Wait for Chrome debugger port and page to be ready
      await self._waitForChromeDebuggerReady();
      await self.focusApplication("Google Chrome");

      // Start dashcam recording
      if (self.dashcamEnabled && !(await self.dashcam.isRecording())) {
        await self.dashcam.start();
      }
    },

    /**
     * Launch VS Code
     * @param {Object} options - VS Code launch options
     * @param {string} [options.workspace] - Workspace/folder to open
     * @param {string[]} [options.extensions=[]] - Extensions to install
     * @returns {Promise<void>}
     */
    vscode: async (options = {}) => {
      const { workspace = null, extensions = [] } = options;

      const shell = self.os === "windows" ? "pwsh" : "sh";

      // Install extensions if provided
      for (const extension of extensions) {
        console.log(`[provision.vscode] Installing extension: ${extension}`);
        await self.exec(
          shell,
          `code --install-extension ${extension} --force`,
          120000,
          true,
        );
        console.log(
          `[provision.vscode] ✅ Extension installed: ${extension}`,
        );
      }

      // Launch VS Code
      const workspaceArg = workspace ? `"${workspace}"` : "";

      if (self.os === "windows") {
        await self.exec(
          shell,
          `Start-Process code -ArgumentList ${workspaceArg}`,
          30000,
        );
      } else {
        await self.exec(
          shell,
          `code ${workspaceArg} >/dev/null 2>&1 &`,
          30000,
        );
      }

      // Wait for VS Code to start up
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Wait for VS Code to be ready
      await self.focusApplication("Visual Studio Code");

      // Start dashcam recording
      if (self.dashcamEnabled && !(await self.dashcam.isRecording())) {
        await self.dashcam.start();
      }
    },

    /**
     * Download and install an application
     * @param {Object} options - Installer options
     * @param {string} options.url - URL to download the installer from
     * @param {string} [options.filename] - Filename to save as (auto-detected from URL if not provided)
     * @param {string} [options.appName] - Application name to focus after install
     * @param {boolean} [options.launch=true] - Whether to launch the app after installation
     * @returns {Promise<string>} Path to the downloaded file
     * @example
     * // Install a .deb package on Linux (auto-detected)
     * await testdriver.provision.installer({
     *   url: 'https://example.com/app.deb',
     *   appName: 'MyApp'
     * });
     *
     * @example
     * // Download and run custom commands
     * const filePath = await testdriver.provision.installer({
     *   url: 'https://example.com/app.AppImage',
     *   launch: false
     * });
     * await testdriver.exec('sh', `chmod +x "${filePath}" && "${filePath}" &`, 10000);
     */
    installer: async (options = {}) => {
      const { url, filename, appName, launch = true } = options;

      if (!url) {
        throw new Error("[provision.installer] url is required");
      }

      const shell = self.os === "windows" ? "pwsh" : "sh";

      // Determine download directory
      const downloadDir =
        self.os === "windows" ? "C:\\Users\\testdriver\\Downloads" : "/tmp";

      console.log(`[provision.installer] Downloading ${url}...`);

      let actualFilePath;

      // Download the file and get the actual filename (handles redirects)
      if (self.os === "windows") {
        // Simple approach: download first, then get the actual filename from the response
        const tempFile = `${downloadDir}\\installer_temp_${Date.now()}`;

        const downloadScript = `
            $ProgressPreference = 'SilentlyContinue'
            $response = Invoke-WebRequest -Uri "${url}" -OutFile "${tempFile}" -PassThru -UseBasicParsing
            
            # Try to get filename from Content-Disposition header
            $filename = $null
            if ($response.Headers['Content-Disposition']) {
              if ($response.Headers['Content-Disposition'] -match 'filename=\\"?([^\\"]+)\\"?') {
                $filename = $matches[1]
              }
            }
            
            # If no filename from header, try to get from URL or use default
            if (-not $filename) {
              $uri = [System.Uri]"${url}"
              $filename = [System.IO.Path]::GetFileName($uri.LocalPath)
              if (-not $filename -or $filename -eq '') {
                $filename = "installer"
              }
            }
            
            # Move temp file to final location with proper filename
            $finalPath = Join-Path "${downloadDir}" $filename
            Move-Item -Path "${tempFile}" -Destination $finalPath -Force
            Write-Output $finalPath
          `;

        const result = await self.exec(shell, downloadScript, 300000, true);
        actualFilePath = result ? result.trim() : null;

        if (!actualFilePath) {
          throw new Error("[provision.installer] Failed to download file");
        }
      } else {
        // Use curl with options to get the final filename
        const tempMarker = `installer_${Date.now()}`;
        const downloadScript = `
            cd "${downloadDir}"
            curl -L -J -O -w "%{filename_effective}" "${url}" 2>/dev/null || echo "${tempMarker}"
          `;

        const result = await self.exec(shell, downloadScript, 300000, true);
        const downloadedFile = result ? result.trim() : null;

        if (downloadedFile && downloadedFile !== tempMarker) {
          actualFilePath = `${downloadDir}/${downloadedFile}`;
        } else {
          // Fallback: use curl without -J and specify output file
          const fallbackFilename = filename || "installer";
          actualFilePath = `${downloadDir}/${fallbackFilename}`;
          await self.exec(
            shell,
            `curl -L -o "${actualFilePath}" "${url}"`,
            300000,
            true,
          );
        }
      }

      console.log(`[provision.installer] ✅ Downloaded to ${actualFilePath}`);

      // Auto-detect install command based on file extension (use actualFilePath for extension detection)
      const actualFilename = actualFilePath.split(/[/\\]/).pop() || "";
      const ext = actualFilename.split(".").pop()?.toLowerCase();
      let installCommand = null;

      if (self.os === "windows") {
        if (ext === "msi") {
          installCommand = `Start-Process msiexec -ArgumentList '/i', '"${actualFilePath}"', '/quiet', '/norestart' -Wait`;
        } else if (ext === "exe") {
          installCommand = `Start-Process "${actualFilePath}" -ArgumentList '/S' -Wait`;
        }
      } else if (self.os === "linux") {
        if (ext === "deb") {
          installCommand = `sudo dpkg -i "${actualFilePath}" && sudo apt-get install -f -y`;
        } else if (ext === "rpm") {
          installCommand = `sudo rpm -i "${actualFilePath}"`;
        } else if (ext === "appimage") {
          installCommand = `chmod +x "${actualFilePath}"`;
        } else if (ext === "sh") {
          installCommand = `chmod +x "${actualFilePath}" && "${actualFilePath}"`;
        }
      } else if (self.os === "darwin") {
        if (ext === "dmg") {
          installCommand = `hdiutil attach "${actualFilePath}" -mountpoint /Volumes/installer && cp -R /Volumes/installer/*.app /Applications/ && hdiutil detach /Volumes/installer`;
        } else if (ext === "pkg") {
          installCommand = `sudo installer -pkg "${actualFilePath}" -target /`;
        }
      }

      if (installCommand) {
        console.log(`[provision.installer] Installing...`);
        await self.exec(shell, installCommand, 300000, true);
        console.log(`[provision.installer] ✅ Installation complete`);
      }

      // Launch and focus the app if appName is provided and launch is true
      if (appName && launch) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await self.focusApplication(appName);
      }

      // Start dashcam recording
      if (self.dashcamEnabled && !(await self.dashcam.isRecording())) {
        await self.dashcam.start();
      }

      return actualFilePath;
    },

    /**
     * Launch Electron app
     * @param {Object} options - Electron launch options
     * @param {string} options.appPath - Path to Electron app (required)
     * @param {string[]} [options.args=[]] - Additional electron args
     * @returns {Promise<void>}
     */
    electron: async (options = {}) => {
      const { appPath, args = [] } = options;

      if (!appPath) {
        throw new Error("provision.electron requires appPath option");
      }

      const shell = self.os === "windows" ? "pwsh" : "sh";

      const argsString = args.join(" ");

      if (self.os === "windows") {
        await self.exec(
          shell,
          `Start-Process electron -ArgumentList "${appPath}", ${argsString}`,
          30000,
        );
      } else {
        await self.exec(
          shell,
          `electron "${appPath}" ${argsString} >/dev/null 2>&1 &`,
          30000,
        );
      }

      await self.focusApplication("Electron");

      // Start dashcam recording
      if (self.dashcamEnabled && !(await self.dashcam.isRecording())) {
        await self.dashcam.start();
      }
    },

    /**
     * Initialize Dashcam recording with logging
     * @param {Object} options - Dashcam options
     * @param {string} [options.logPath] - Path to log file (auto-generated if not provided)
     * @param {string} [options.logName='TestDriver Log'] - Display name for the log
     * @param {boolean} [options.webLogs=true] - Enable web log tracking
     * @param {string} [options.title] - Custom title for the recording
     * @returns {Promise<void>}
     */
    dashcam: async (options = {}) => {
      const {
        logPath,
        logName = "TestDriver Log",
        webLogs = true,
        title,
      } = options;

      // Ensure dashcam is enabled
      if (!self.dashcamEnabled) {
        console.warn(
          "[provision.dashcam] Dashcam is not enabled. Skipping.",
        );
        return;
      }

      // Set custom title if provided
      if (title) {
        self.dashcam.setTitle(title);
      }

      // Add file log tracking
      const actualLogPath =
        logPath ||
        (self.os === "windows"
          ? "C:\\Users\\testdriver\\testdriver.log"
          : "/tmp/testdriver.log");

      await self.dashcam.addFileLog(actualLogPath, logName);

      // Add web log tracking if enabled
      // Use domain pattern from provisioned Chrome URL if available
      if (webLogs) {
        const pattern = self._provisionedChromeUrl
          ? self._getUrlDomainPattern(self._provisionedChromeUrl)
          : "**";
        await self.dashcam.addWebLog(pattern, "Web Logs");
      }

      // Start recording if not already recording
      if (!(await self.dashcam.isRecording())) {
        await self.dashcam.start();
      }

      console.log("[provision.dashcam] ✅ Dashcam recording started");
    },
  };

  // Wrap all provision methods with reconnect check using Proxy
  return new Proxy(provisionMethods, {
    get(target, prop) {
      const method = target[prop];
      if (typeof method === "function") {
        return async (...args) => {
          // Skip provisioning if reconnecting to existing sandbox
          if (self.reconnect) {
            console.log(
              `[provision.${prop}] Skipping provisioning (reconnect mode)`,
            );
            return;
          }
          return method(...args);
        };
      }
      return method;
    },
  });
}

module.exports = { createProvisionAPI };
