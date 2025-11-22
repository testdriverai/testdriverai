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
  if (client.os === "windows") {
    const shell = "pwsh";

    let debug = await client.exec(
      shell,
      `query session`,
      40000,
      true,
    );

    console.log("Debug version output:", debug);

    let installDashcam = await client.exec(
      shell,
      `npm install dashcam@beta -g`,
      120000,
      true,
    );
    console.log("Install dashcam output:", installDashcam);

    let dashcamVersion = await client.exec(shell, `npm ls dashcam -g`, 40000, true);
    console.log("Dashcam version:", dashcamVersion);

    const authOutput = await client.exec(shell, `dashcam auth ${apiKey}`, 120000, true);
    console.log("Auth output:", authOutput);
    return;
  }
  
  const shell = "sh";
  const authOutput = await client.exec(shell, `dashcam auth ${apiKey}`, 120000, true);
  console.log("Auth output:", authOutput);
}

/**
 * Add log file tracking to dashcam
 * @param {TestDriver} client - TestDriver client
 * @param {string} logName - Name for the log in dashcam (default: "TestDriver Log")
 */
export async function addDashcamLog(client, logName = "TestDriver Log") {
  if (client.os === "windows") {
    const shell = "pwsh";
    const logPath = "C:\\Users\\testdriver\\Documents\\testdriver.log";
    const createFileOutput = await client.exec(
      shell,
      `New-Item -ItemType File -Path "${logPath}" -Force`,
      10000,
      true,
    );
    console.log("Create log file output:", createFileOutput);
    const addLogOutput = await client.exec(
      shell,
      `dashcam logs --add --type=file --file="${logPath}" --name="${logName}"`,
      10000,
      true,
    );
    console.log("Add log tracking output:", addLogOutput);
    return;
  }

  const shell = "sh";
  const logPath = "/tmp/testdriver.log";

  // Create log file
  await client.exec(shell, `touch ${logPath}`, 10000, true);

  // Add log tracking
  const addLogOutput = await client.exec(
    shell,
    `dashcam logs --add --type=file --file="${logPath}" --name="${logName}"`,
    10000,
    true,
  );
  console.log("Add log tracking output:", addLogOutput);
}

/**
 * Start dashcam recording
 * @param {TestDriver} client - TestDriver client
 */
export async function startDashcam(client) {
  if (client.os === "windows") {
    console.log("Starting dashcam recording on Windows...");
    
    // Start dashcam using Start-Process without output redirection
    // Let dashcam handle its own logging
    const startScript = `Start-Process "cmd.exe" -ArgumentList "/c", "dashcam record"`;
    
    const startOutput = await client.exec("pwsh", startScript, 10000);
    console.log("Start process output:", startOutput);
    
    console.log("✅ Dashcam recording started");
    return;
  }
  
  const shell = "sh";
  await client.exec(shell, `dashcam record >/dev/null 2>&1 &`);
}

/**
 * Stop dashcam recording and retrieve URL
 * @param {TestDriver} client - TestDriver client
 * @returns {Promise<string|null>} Dashcam URL if available
 */
export async function stopDashcam(client) {
  console.log("🎬 Stopping dashcam and retrieving URL...");

  if (client.os === "windows") {
    console.log("Stopping dashcam process on Windows...");
    
    // Set UTF-8 encoding to handle emojis and special characters in output
    let stop = await client.exec(
      "pwsh", "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; dashcam stop", 120000);


    console.log("📤 Dashcam stop command output:", stop);

    let urlData = stop;
    
    // Extract URL from output
    if (urlData) {
      const urlMatch = urlData.match(/https?:\/\/[^\s"',}]+/);
      if (urlMatch) {
        const url = urlMatch[0];
        console.log("✅ Found dashcam URL:", url);
        return url;
      } else {
        console.warn("⚠️  No URL found in dashcam config");
      }
    }
    return null;
  }
  
  const shell = "sh";
  // On non-Windows, use regular stop command
  const output = await client.exec(shell, "dashcam stop", 60000, false);
  
  console.log("📤 Dashcam command output:", output);

  // Extract URL from output
  if (output) {
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
