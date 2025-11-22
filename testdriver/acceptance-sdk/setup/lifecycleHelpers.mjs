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

    // Uninstall and clear cache first to ensure fresh install
    await client.exec(shell, `npm uninstall dashcam -g`, 40000, true);
    await client.exec(shell, `npm cache clean --force`, 40000, true);
    
    let installDashcam = await client.exec(
      shell,
      `npm install dashcam@beta -g`,
      120000,
      true,
    );
    console.log("Install dashcam output:", installDashcam);

    // Get version from package.json
    let latestVersion = await client.exec(
      shell, 
      `npm view dashcam@beta version`, 
      40000, 
      true
    );
    console.log("Latest beta version available:", latestVersion);
    
    // Get the npm global prefix path
    let npmPrefix = await client.exec(shell, `npm prefix -g`, 40000, true);
    const dashcamPath = npmPrefix.trim() + '\\dashcam.cmd';
    console.log("Dashcam executable path:", dashcamPath);
    
    let installedVersion = await client.exec(shell, `npm ls dashcam -g`, 40000, true);
    console.log("Installed dashcam version:", installedVersion);
    
    // Test that dashcam version command works using explicit path
    let dashcamVersionTest = await client.exec(shell, `& "${dashcamPath}" version`, 40000, true);
    console.log("Dashcam version test:", dashcamVersionTest);
    
    // Verify we have a version installed
    if (!installedVersion) {
      console.error("❌ Dashcam version command returned null/empty");
      console.log("Install output was:", installDashcam);
    } else if (!installedVersion.includes("1.3.")) {
      console.warn("⚠️  Dashcam version may be outdated. Expected 1.3.x, got:", installedVersion);
    } else {
      console.log("✅ Dashcam version verified:", installedVersion);
    }

    const authOutput = await client.exec(shell, `& "${dashcamPath}" auth ${apiKey}`, 120000, true);
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

    let npmPrefix = await client.exec(shell, `npm prefix -g`, 40000, true);
    const dashcamPath = npmPrefix.trim() + '\\dashcam.cmd';
    const addLogOutput = await client.exec(shell, `& "${dashcamPath}" logs --add --type=file --file="${logPath}" --name="${logName}"`, 120000, true);

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
    
    // Get explicit path to dashcam
    let npmPrefix = await client.exec("pwsh", `npm prefix -g`, 40000, true);
    const dashcamPath = npmPrefix.trim() + '\\dashcam.cmd';
    console.log("📍 Dashcam path:", dashcamPath);
    
    // Verify dashcam.cmd exists
    const dashcamExists = await client.exec("pwsh", `Test-Path "${dashcamPath}"`, 10000, true);
    console.log("✓ Dashcam.cmd exists:", dashcamExists);
    
    // Start dashcam record and redirect output to a file so we can see errors
    const outputFile = "C:\\Users\\testdriver\\.dashcam-cli\\dashcam-start.log";
    const startScript = `
      try {
        $process = Start-Process "cmd.exe" -ArgumentList "/c", "${dashcamPath} record > ${outputFile} 2>&1" -PassThru
        Write-Output "Process started with PID: $($process.Id)"
        Start-Sleep -Seconds 2
        if ($process.HasExited) {
          Write-Output "Process has already exited with code: $($process.ExitCode)"
        } else {
          Write-Output "Process is still running"
        }
      } catch {
        Write-Output "ERROR: $_"
      }
    `;
    const startOutput = await client.exec("pwsh", startScript, 10000, true);
    console.log("📋 Start-Process output:", startOutput);
    
    // Read the output file to see what dashcam record produced
    await new Promise(resolve => setTimeout(resolve, 2000));
    const dashcamOutput = await client.exec("pwsh", `Get-Content "${outputFile}" -ErrorAction SilentlyContinue`, 10000, true);
    console.log("📝 Dashcam record output:", dashcamOutput);
    
    // Give the background process a moment to initialize and create status file
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check if status file was created
    const statusCheck = await client.exec("pwsh", `Get-Content "C:\\Users\\testdriver\\.dashcam-cli\\status.json" -ErrorAction SilentlyContinue`, 10000, true);
    console.log("📋 Status file after start:", statusCheck);
    
    // Check if logs directory exists
    const logsDirCheck = await client.exec("pwsh", `Test-Path "C:\\Users\\testdriver\\.dashcam-cli\\logs"`, 10000, true);
    console.log("📁 Logs directory exists:", logsDirCheck);
    
    // List all log files with their sizes and modification times
    const allLogs = await client.exec("pwsh", `Get-ChildItem "C:\\Users\\testdriver\\.dashcam-cli\\logs\\*.log" -ErrorAction SilentlyContinue | Select-Object Name,Length,LastWriteTime | Format-Table -AutoSize`, 10000, true);
    console.log("📋 All log files:", allLogs);
    
    // List all files in .dashcam-cli directory
    const allFiles = await client.exec("pwsh", `Get-ChildItem "C:\\Users\\testdriver\\.dashcam-cli" -Recurse -ErrorAction SilentlyContinue | Select-Object FullName`, 10000, true);
    console.log("📂 All files in .dashcam-cli:", allFiles);
    
    // Check background process logs
    const latestLog = await client.exec("pwsh", `Get-ChildItem "C:\\Users\\testdriver\\.dashcam-cli\\logs\\*.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | Get-Content`, 10000, true);
    console.log("📝 Background process log (full content):", latestLog);
    
    // Check if any dashcam processes are running
    const processes = await client.exec("pwsh", `Get-Process -Name node -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,Path`, 10000, true);
    console.log("🔍 Node processes:", processes);
    
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
    
    // Get explicit path to dashcam
    const npmPrefix = await client.exec("pwsh", `npm prefix -g`, 40000, true);
    const dashcamPath = npmPrefix.trim() + '\\dashcam.cmd';
    
    // Check status file before stopping
    const statusPath = "C:\\Users\\testdriver\\.dashcam-cli\\status.json";
    const statusBefore = await client.exec("pwsh", `Get-Content "${statusPath}" -ErrorAction SilentlyContinue`, 10000, true);
    console.log("📋 Status file before stop:", statusBefore);
    
    // Set UTF-8 encoding to handle emojis and special characters in output
    let stop = await client.exec(
      "pwsh", `& "${dashcamPath}" stop`, 120000);


    console.log("📤 Dashcam stop command output:", stop);
    
    // Check status file after stopping
    const statusAfter = await client.exec("pwsh", `Get-Content "${statusPath}" -ErrorAction SilentlyContinue`, 10000, true);
    console.log("📋 Status file after stop:", statusAfter);
    
    // Check background process log to see what happened
    const bgLog = await client.exec("pwsh", `Get-ChildItem "C:\\Users\\testdriver\\.dashcam-cli\\logs\\*.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | Get-Content -Tail 100`, 10000, true);
    console.log("📝 Background process log (last 100 lines):", bgLog);
    
    // Check for signal marker file
    const signalMarker = await client.exec("pwsh", `Get-Content "C:\\Users\\testdriver\\.dashcam-cli\\signal-received.txt" -ErrorAction SilentlyContinue`, 10000, true);
    console.log("🎯 Signal marker file:", signalMarker);
    
    // Check for recording-result.json file
    const recordingResult = await client.exec("pwsh", `Get-Content "C:\\Users\\testdriver\\.dashcam-cli\\recording-result.json" -ErrorAction SilentlyContinue`, 10000, true);
    console.log("📤 Recording result file:", recordingResult);
    
    // Check for video files
    const videoFiles = await client.exec("pwsh", `Get-ChildItem "C:\\Users\\testdriver\\.dashcam-cli\\*" -Include *.mp4 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name`, 10000, true);
    console.log("🎥 Video files in .dashcam-cli:", videoFiles);

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
  const npmPrefix = await client.exec(shell, `npm prefix -g`, 40000, true);
  const dashcamPath = npmPrefix.trim() + '/bin/dashcam';
  const output = await client.exec(shell, `"${dashcamPath}" stop`, 60000, false);
  
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
