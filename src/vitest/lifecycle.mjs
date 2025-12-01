/**
 * Lifecycle Helpers for TestDriver Vitest Plugin
 * 
 * Provides reusable lifecycle hook functions for common test patterns.
 * These are thin wrappers around the Dashcam class.
 * 
 * @example
 * import { launchChrome, waitForPage } from 'testdriverai/vitest';
 * 
 * test('my test', async (context) => {
 *   const testdriver = TestDriver(context);
 *   await testdriver.provision.chrome({ url: 'https://example.com' });
 *   
 *   // Or use manual lifecycle helpers
 *   await launchChrome(testdriver, 'https://other-site.com');
 *   await waitForPage(testdriver, 'Welcome');
 * });
 */

import Dashcam from '../core/Dashcam.js';

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
 * @param {TestDriver} client - TestDriver client
 * @param {string} apiKey - Dashcam API key (default from environment)
 */
export async function authDashcam(client, apiKey) {
  const dashcam = getDashcam(client, { apiKey });
  await dashcam.auth();
}

/**
 * Add log file tracking to dashcam
 * @param {TestDriver} client - TestDriver client
 * @param {string} logName - Name for the log in dashcam (default: "TestDriver Log")
 */
export async function addDashcamLog(client, logName = "TestDriver Log") {
  const dashcam = getDashcam(client);
  const logPath = client.os === "windows" 
    ? "C:\\Users\\testdriver\\Documents\\testdriver.log"
    : "/tmp/testdriver.log";
  
  // Create log file first
  const shell = client.os === "windows" ? "pwsh" : "sh";
  if (client.os === "windows") {
    await client.exec(shell, `New-Item -ItemType File -Path "${logPath}" -Force`, 10000, true);
  } else {
    await client.exec(shell, `touch ${logPath}`, 10000, true);
  }
  
  await dashcam.addFileLog(logPath, logName);
}

/**
 * Start dashcam recording
 * @param {TestDriver} client - TestDriver client
 */
export async function startDashcam(client) {
  const dashcam = getDashcam(client);
  await dashcam.start();
}

/**
 * Stop dashcam recording and retrieve URL
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
 * Launch Chrome browser
 * @param {TestDriver} client - TestDriver client
 * @param {string} url - URL to open
 * @param {object} options - Browser options
 * @param {boolean} options.guest - Launch in guest mode (default: true)
 * @param {boolean} options.maximized - Start maximized (default: true)
 */
export async function launchChrome(client, url = "about:blank", options = {}) {
  const { guest = true, maximized = true } = options;
  const shell = client.os === "windows" ? "pwsh" : "sh";
  
  const guestFlag = guest ? "--guest" : "";
  const maxFlag = maximized ? "--start-maximized" : "";

  if (client.os === "windows") {
    const args = [maxFlag, guestFlag, `"${url}"`].filter(Boolean).join('", "');
    await client.exec(
      "pwsh",
      `Start-Process "C:/Program Files/Google/Chrome/Application/chrome.exe" -ArgumentList "${args}"`,
      30000,
    );
  } else {
    const flags = [maxFlag, "--disable-fre", "--no-default-browser-check", "--no-first-run", guestFlag].filter(Boolean).join(" ");
    await client.exec(
      shell,
      `google-chrome ${flags} "${url}" >/dev/null 2>&1 &`,
      30000,
    );
  }
}

/**
 * Launch Chrome for Testing browser
 * @param {TestDriver} client - TestDriver client
 * @param {string} url - URL to open
 * @param {object} options - Browser options
 */
export async function launchChromeForTesting(client, url = "about:blank", options = {}) {
  const { guest = true, maximized = true } = options;
  const shell = client.os === "windows" ? "pwsh" : "sh";
  
  const guestFlag = guest ? "--guest" : "";
  const maxFlag = maximized ? "--start-maximized" : "";

  if (client.os === "windows") {
    // Fallback to regular Chrome on Windows
    await launchChrome(client, url, options);
  } else {
    const flags = [maxFlag, "--disable-fre", "--no-default-browser-check", "--no-first-run", guestFlag].filter(Boolean).join(" ");
    await client.exec(
      shell,
      `chrome-for-testing ${flags} "${url}" >/dev/null 2>&1 &`,
      30000,
    );
  }
}

/**
 * Launch Chrome with a Chrome extension loaded
 * @param {TestDriver} client - TestDriver client
 * @param {string} extensionId - Chrome Web Store extension ID
 * @param {string} url - URL to open
 * @example
 * // Launch with uBlock Origin extension
 * await launchChromeExtension(client, "cjpalhdlnbpafiamejdnhcphjbkeiagm");
 */
export async function launchChromeExtension(client, extensionId, url = "about:blank") {
  const shell = client.os === "windows" ? "pwsh" : "sh";

  if (client.os === "windows") {
    await client.exec(
      "pwsh",
      `Start-Process "C:/Program Files/Google/Chrome/Application/chrome.exe" -ArgumentList "--start-maximized", "--load-extension=${extensionId}", "${url}"`,
      30000,
    );
  } else {
    await client.exec(
      shell,
      `chrome-for-testing --start-maximized --disable-fre --no-default-browser-check --no-first-run --load-extension=${extensionId} "${url}" >/dev/null 2>&1 &`,
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
 * @returns {Promise<boolean>} True if text was found
 */
export async function waitForPage(client, text, maxAttempts = 60, pollInterval = 5000) {
  console.log("Waiting for page to load, looking for text:", text);
  for (let i = 0; i < maxAttempts; i++) {
    const element = await client.find(text);
    if (element.found()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }
  return false;
}

/**
 * Run standard prerun lifecycle hooks
 * Authenticates, starts dashcam, launches Chrome
 * @param {TestDriver} client - TestDriver client
 * @param {object} options - Options
 * @param {string} options.url - URL to open (default: sandbox)
 * @param {string} options.waitForText - Text to wait for after page load
 */
export async function runPrerun(client, options = {}) {
  const { 
    url = "http://testdriver-sandbox.vercel.app/", 
    waitForText = "TestDriver.ai Sandbox" 
  } = options;
  
  await authDashcam(client);
  await addDashcamLog(client);
  await startDashcam(client);
  await launchChrome(client, url);
  if (waitForText) {
    await waitForPage(client, waitForText);
  }
}

/**
 * Run prerun with Chrome for Testing
 * @param {TestDriver} client - TestDriver client
 * @param {object} options - Options
 */
export async function runPrerunChromeForTesting(client, options = {}) {
  const { 
    url = "http://testdriver-sandbox.vercel.app/", 
    waitForText = "TestDriver.ai Sandbox" 
  } = options;
  
  await authDashcam(client);
  await addDashcamLog(client);
  await startDashcam(client);
  await launchChromeForTesting(client, url);
  if (waitForText) {
    await waitForPage(client, waitForText);
  }
}

/**
 * Run prerun with Chrome extension
 * @param {TestDriver} client - TestDriver client
 * @param {string} extensionId - Chrome extension ID
 * @param {object} options - Options
 */
export async function runPrerunChromeExtension(client, extensionId, options = {}) {
  const { 
    url = "http://testdriver-sandbox.vercel.app/", 
    waitForText = "TestDriver.ai Sandbox" 
  } = options;
  
  await authDashcam(client);
  await addDashcamLog(client);
  await startDashcam(client);
  await launchChromeExtension(client, extensionId, url);
  if (waitForText) {
    await waitForPage(client, waitForText);
  }
}

/**
 * Run standard postrun lifecycle hooks
 * Stops dashcam and returns URL
 * @param {TestDriver} client - TestDriver client
 * @returns {Promise<string|null>} Dashcam URL if available
 */
export async function runPostrun(client) {
  return await stopDashcam(client);
}
