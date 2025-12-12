/**
 * Lifecycle Helpers
 * Shared lifecycle hook functions (prerun, postrun)
 * 
 * LEGACY: These helpers are thin wrappers around the new Dashcam class.
 * For new code, prefer using the Dashcam class directly:
 * 
 * import { Dashcam } from 'testdriverai/core';
 * const dashcam = new Dashcam(client);
 * await dashcam.auth();
 */

import Dashcam from '../../../lib/core/Dashcam.js';

// Module-level cache to maintain Dashcam instance state across helper calls
const dashcamInstances = new WeakMap();

/**
 * Get or create Dashcam instance for a client
 * @private
 * @param {TestDriver} client 
 * @param {object} options 
 * @returns {Dashcam}
 */
function getDashcam(client, options = {}) {
  if (!dashcamInstances.has(client)) {
    dashcamInstances.set(client, new Dashcam(client, options));
  }
  return dashcamInstances.get(client);
}

/**
 * Authenticate dashcam with API key
 * @deprecated Use `new Dashcam(client)` and `dashcam.auth()` instead
 * @param {TestDriver} client - TestDriver client
 * @param {string} apiKey - Dashcam API key (default: 4e93d8bf-3886-4d26-a144-116c4063522d)
 */
export async function authDashcam(
  client,
  apiKey = "4e93d8bf-3886-4d26-a144-116c4063522d",
) {
  const dashcam = getDashcam(client, { apiKey });
  await dashcam.auth();
}

/**
 * Add log file tracking to dashcam
 * @deprecated Use `new Dashcam(client)` and `dashcam.addFileLog()` instead
 * @param {TestDriver} client - TestDriver client
 * @param {string} logName - Name for the log in dashcam (default: "TestDriver Log")
 */
export async function addDashcamLog(client, logName = "TestDriver Log") {
  const dashcam = getDashcam(client);
  const logPath = client.os === "windows" 
    ? "C:\\Users\\testdriver\\Documents\\testdriver.log"
    : "/tmp/testdriver.log";
  
  // Create log file first
  if (client.os === "windows") {
    await client.exec("pwsh", `New-Item -ItemType File -Path "${logPath}" -Force`, 10000, true);
  } else {
    await client.exec("sh", `touch ${logPath}`, 10000, true);
  }
  
  await dashcam.addFileLog(logPath, logName);
}

/**
 * Start dashcam recording
 * @deprecated Use `new Dashcam(client)` and `dashcam.start()` instead
 * @param {TestDriver} client - TestDriver client
 */
export async function startDashcam(client) {
  const dashcam = getDashcam(client);
  await dashcam.start();
}

/**
 * Stop dashcam recording and retrieve URL
 * @deprecated Use `new Dashcam(client)` and `dashcam.stop()` instead
 * @param {TestDriver} client - TestDriver client
 * @returns {Promise<string|null>} Dashcam URL if available
 */
export async function stopDashcam(client) {
  console.log("🎬 Stopping dashcam and retrieving URL...");
  const dashcam = getDashcam(client);
  const url = await dashcam.stop();
  
  if (url) {
    console.log("✅ Found dashcam URL:", url);
    console.log("🎥 Dashcam URL:", url);
  } else {
    console.warn("⚠️  No replay URL found in dashcam output");
  }
  
  return url;
}

/**
 * Launch Chrome browser with guest mode
 * @param {TestDriver} client - TestDriver client
 * @param {string} url - URL to open (default: https://testdriver-sandbox.vercel.app/)
 */
export async function launchChrome(
  client,
  url = "http://testdriver-sandbox.vercel.app/",
) {
  const shell = client.os === "windows" ? "pwsh" : "sh";

  if (client.os === "windows") {
    await client.exec(
      "pwsh",
      `Start-Process "C:/Program Files/Google/Chrome/Application/chrome.exe" -ArgumentList "--start-maximized", "--guest", "${url}"`,
      30000,
    );
  } else {
    await client.exec(
      shell,
      `google-chrome --start-maximized --disable-fre --no-default-browser-check --no-first-run --guest "${url}" >/dev/null 2>&1 &`,
      30000,
    );
  }
}

/**
 * Launch Chrome for Testing browser with custom profile
 * @param {TestDriver} client - TestDriver client
 * @param {string} url - URL to open (default: https://testdriver-sandbox.vercel.app/)
 */
export async function launchChromeForTesting(
  client,
  url = "http://testdriver-sandbox.vercel.app/",
) {
  const shell = client.os === "windows" ? "pwsh" : "sh";
  const userDataDir = client.os === "windows" 
    ? "C:\\Users\\testdriver\\AppData\\Local\\TestDriver\\Chrome"
    : "/tmp/testdriver-chrome-profile";
  
  // Create user data directory and Default profile directory
  const defaultProfileDir = client.os === "windows"
    ? `${userDataDir}\\Default`
    : `${userDataDir}/Default`;
  
  const createDirCmd = client.os === "windows"
    ? `New-Item -ItemType Directory -Path "${defaultProfileDir}" -Force | Out-Null`
    : `mkdir -p "${defaultProfileDir}"`;
  
  await client.exec(shell, createDirCmd, 10000, true);
  
  // Write Chrome preferences
  const chromePrefs = {
    credentials_enable_service: false,
    profile: {
      password_manager_enabled: false,
      default_content_setting_values: {}
    },
    signin: {
      allowed: false
    },
    sync: {
      requested: false,
      first_setup_complete: true,
      sync_all_os_types: false
    },
    autofill: {
      enabled: false
    },
    local_state: {
      browser: {
        has_seen_welcome_page: true
      }
    }
  };
  
  const prefsPath = client.os === "windows"
    ? `${defaultProfileDir}\\Preferences`
    : `${defaultProfileDir}/Preferences`;
  
  const prefsJson = JSON.stringify(chromePrefs, null, 2);
  const writePrefCmd = client.os === "windows"
    ? `Set-Content -Path "${prefsPath}" -Value '${prefsJson.replace(/'/g, "''")}'`
    : `cat > "${prefsPath}" << 'EOF'\n${prefsJson}\nEOF`;
  
  await client.exec(shell, writePrefCmd, 10000, true);

  if (client.os === "windows") {
    // Windows Chrome for Testing path would need to be determined
    // For now, fallback to regular Chrome on Windows
    await client.exec(
      "pwsh",
      `Start-Process "C:/Program Files/Google/Chrome/Application/chrome.exe" -ArgumentList "--start-maximized", "--user-data-dir=${userDataDir}", "--disable-fre", "--no-default-browser-check", "--no-first-run", "${url}"`,
      30000,
    );
  } else {
    await client.exec(
      shell,
      `chrome-for-testing --start-maximized --disable-fre --no-default-browser-check --no-first-run --user-data-dir=${userDataDir} "${url}" >/dev/null 2>&1 &`,
      30000,
    );
  }
}

/**
 * Launch Chrome for Testing with a Chrome extension loaded
 * Also loads dashcam-chrome extension for web log capture on Linux
 * @param {TestDriver} client - TestDriver client
 * @param {string} extensionPath - Local filesystem path to the unpacked extension directory
 * @param {string} url - URL to open (default: https://testdriver-sandbox.vercel.app/)
 * @example
 * // Clone an extension and launch Chrome with it
 * await client.exec('sh', 'git clone https://github.com/user/extension.git /tmp/extension');
 * await launchChromeExtension(client, '/tmp/extension');
 */
export async function launchChromeExtension(
  client,
  extensionPath,
  url = "http://testdriver-sandbox.vercel.app/",
) {
  const shell = client.os === "windows" ? "pwsh" : "sh";
  const userDataDir = client.os === "windows" 
    ? "C:\\Users\\testdriver\\AppData\\Local\\TestDriver\\Chrome"
    : "/tmp/testdriver-chrome-profile";
  
  // Create user data directory and Default profile directory
  const defaultProfileDir = client.os === "windows"
    ? `${userDataDir}\\Default`
    : `${userDataDir}/Default`;
  
  const createDirCmd = client.os === "windows"
    ? `New-Item -ItemType Directory -Path "${defaultProfileDir}" -Force | Out-Null`
    : `mkdir -p "${defaultProfileDir}"`;
  
  await client.exec(shell, createDirCmd, 10000, true);
  
  // Write Chrome preferences
  const chromePrefs = {
    credentials_enable_service: false,
    profile: {
      password_manager_enabled: false,
      default_content_setting_values: {}
    },
    signin: {
      allowed: false
    },
    sync: {
      requested: false,
      first_setup_complete: true,
      sync_all_os_types: false
    },
    autofill: {
      enabled: false
    },
    local_state: {
      browser: {
        has_seen_welcome_page: true
      }
    }
  };
  
  const prefsPath = client.os === "windows"
    ? `${defaultProfileDir}\\Preferences`
    : `${defaultProfileDir}/Preferences`;
  
  const prefsJson = JSON.stringify(chromePrefs, null, 2);
  const writePrefCmd = client.os === "windows"
    ? `Set-Content -Path "${prefsPath}" -Value '${prefsJson.replace(/'/g, "''")}'`
    : `cat > "${prefsPath}" << 'EOF'\n${prefsJson}\nEOF`;
  
  await client.exec(shell, writePrefCmd, 10000, true);

  if (client.os === "windows") {
    // Windows Chrome for Testing path would need to be determined
    // For now, fallback to regular Chrome on Windows
    await client.exec(
      "pwsh",
      `Start-Process "C:/Program Files/Google/Chrome/Application/chrome.exe" -ArgumentList "--start-maximized", "--user-data-dir=${userDataDir}", "--load-extension=${extensionPath}", "${url}"`,
      30000,
    );
  } else {
    // Load both user extension and dashcam-chrome for web log capture
    const extensionsToLoad = `${extensionPath},/usr/lib/node_modules/dashcam-chrome/build`;
    await client.exec(
      shell,
      `chrome-for-testing --start-maximized --disable-fre --no-default-browser-check --no-first-run --user-data-dir=${userDataDir} --load-extension=${extensionsToLoad} "${url}" >/dev/null 2>&1 &`,
      30000,
    );
  }
}

/**
 * Wait for page to load by polling for text
 * @param {TestDriver} client - TestDriver client
 * @param {string} text - Text to wait for
 * @param {number} maxAttempts - Maximum number of attempts (default: 60)
 * @param {number} pollInterval - Interval between polls in ms (default: 5000)
 */
export async function waitForPage(
  client,
  text,
  maxAttempts = 60,
  pollInterval = 5000,
) {
  console.log("Waiting for page to load, looking for text:", text);
  let element;
  for (let i = 0; i < maxAttempts; i++) {
    element = await client.find(text);
    if (element.found()) break;
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }
}

/**
 * Run prerun lifecycle hooks
 * Implements lifecycle/prerun.yaml functionality
 * @param {TestDriver} client - TestDriver client
 */
export async function runPrerun(client) {
  await authDashcam(client);
  await addDashcamLog(client);
  await startDashcam(client);
  await launchChrome(client);
  await waitForPage(client, "TestDriver.ai Sandbox");
}

/**
 * Run prerun lifecycle hooks with Chrome for Testing
 * Implements lifecycle/prerun.yaml functionality using Chrome for Testing
 * @param {TestDriver} client - TestDriver client
 */
export async function runPrerunChromeForTesting(client) {
  await authDashcam(client);
  await addDashcamLog(client);
  await startDashcam(client);
  await launchChromeForTesting(client);
  await waitForPage(client, "TestDriver.ai Sandbox");
}

/**
 * Run prerun lifecycle hooks with Chrome extension loaded
 * Implements lifecycle/prerun.yaml functionality with a Chrome extension
 * @param {TestDriver} client - TestDriver client
 * @param {string} extensionPath - Local filesystem path to the unpacked extension directory
 * @example
 * // Clone an extension and run prerun with it
 * await client.exec('sh', 'git clone https://github.com/user/extension.git /tmp/extension');
 * await runPrerunChromeExtension(client, '/tmp/extension');
 */
export async function runPrerunChromeExtension(client, extensionPath) {
  await authDashcam(client);
  await addDashcamLog(client);
  await startDashcam(client);
  await launchChromeExtension(client, extensionPath);
  await waitForPage(client, "TestDriver.ai Sandbox");
}

/**
 * Run postrun lifecycle hooks
 * Implements lifecycle/postrun.yaml functionality
 * @param {TestDriver} client - TestDriver client
 * @returns {Promise<string|null>} Dashcam URL if available
 */
export async function runPostrun(client) {
  return await stopDashcam(client);
}
