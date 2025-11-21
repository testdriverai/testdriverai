/**
 * Lifecycle Helpers
 * Shared lifecycle hook functions (prerun, postrun)
 */

/**
 * Authenticate dashcam with API key
 * @param {TestDriver} client - TestDriver client
 * @param {string} apiKey - Dashcam API key (default: 4e93d8bf-3886-4d26-a144-116c4063522d)
 */
export async function authDashcam(
  client,
  apiKey = "4e93d8bf-3886-4d26-a144-116c4063522d",
) {
  const shell = client.os === "windows" ? "pwsh" : "sh";
  await client.exec(shell, `dashcam auth ${apiKey}`, 30000, true);
}

/**
 * Add log file tracking to dashcam
 * @param {TestDriver} client - TestDriver client
 * @param {string} logName - Name for the log in dashcam (default: "TestDriver Log")
 */
export async function addDashcamLog(client, logName = "TestDriver Log") {
  const shell = client.os === "windows" ? "pwsh" : "sh";
  const logPath =
    client.os === "windows"
      ? "C:\\Users\\testdriver\\Documents\\testdriver.log"
      : "/tmp/testdriver.log";

  // Create log file
  if (client.os === "windows") {
    await client.exec(
      shell,
      `New-Item -ItemType File -Path "${logPath}" -Force`,
      10000,
      true,
    );
  } else {
    await client.exec(shell, `touch ${logPath}`, 10000, true);
  }

  // Add log tracking
  await client.exec(
    shell,
    `dashcam logs --add --type=file --file="${logPath}" --name="${logName}"`,
    10000,
    true,
  );
}

/**
 * Start dashcam recording
 * @param {TestDriver} client - TestDriver client
 */
export async function startDashcam(client) {
  const shell = client.os === "windows" ? "pwsh" : "sh";

  if (client.os === "windows") {
    await client.exec("pwsh", "npm install -g dashcam@beta", 60000 * 10);

    // Use cmd.exe to run dashcam record in background on Windows
    await client.exec("pwsh", "npm ls dashcam -g");

    // Use cmd.exe to run dashcam record in background on Windows
    await client.exec("pwsh", "dashcam start", 60000);
  } else {
    await client.exec(shell, "dashcam record >/dev/null 2>&1 &");
  }
}

/**
 * Stop dashcam recording and retrieve URL
 * @param {TestDriver} client - TestDriver client
 * @returns {Promise<string|null>} Dashcam URL if available
 */
export async function stopDashcam(client) {
  console.log("🎬 Stopping dashcam and retrieving URL...");

  const shell = client.os === "windows" ? "pwsh" : "sh";

  // Stop dashcam with title and push - this returns the URL
  const output = await client.exec(shell, "dashcam stop", 60000, false); // Don't silence output so we can capture it

  console.log("📤 Dashcam command output:", output);

  // Extract URL from output - dashcam typically outputs the URL in the response
  // The URL is usually in the format: https://dashcam.testdriver.ai/...
  if (output) {
    // Match URL but stop at whitespace or quotes
    const urlMatch = output.match(/https?:\/\/[^\s"']+/);
    if (urlMatch) {
      const url = urlMatch[0];
      console.log("✅ Found dashcam URL:", url);
      return url;
    } else {
      console.warn("⚠️  No URL found in dashcam output");
    }
  } else {
    console.warn("⚠️  Dashcam command returned no output");
  }

  return null;
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

    console.log("foudn", element.found());
    console.log("Debug Info:");
    console.log(element.getDebugInfo());

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
