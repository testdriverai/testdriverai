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

import Dashcam from '../../../src/core/Dashcam.js';

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
 * Run postrun lifecycle hooks
 * Implements lifecycle/postrun.yaml functionality
 * @param {TestDriver} client - TestDriver client
 * @returns {Promise<string|null>} Dashcam URL if available
 */
export async function runPostrun(client) {
  return await stopDashcam(client);
}
