// this file is called by `commands.js` to focus on a window
const path = require("path");
const { execSync } = require("child_process");
const { platform } = require("./system");

// apple script that focuses on a window
const appleScript = (windowName) => `
tell application "System Events" to tell process "${windowName}"
    set frontmost to true
end tell
`;

const hideTerminalScript = (windowName) => `
tell application "${windowName}" to set miniaturized of front window to true
`
const showTerminalScript = (windowName) => `
tell application "${windowName}" to set miniaturized of front window to false
`

async function focusApplication(appName) {
  if (platform() == "mac") {
    return await execSync(`osascript -e '${appleScript(appName)}'`);
  } else if (platform() == "linux") {
    // TODO: This needs fixing
    return await execSync(`wmctrl -a '${appName}'`);
  } else if (platform() == "windows") {
    const scriptPath = path.join(__dirname, "focusWindow.ps1");
    return await execSync(`powershell ${scriptPath} '${appName}'`);
  }
}

async function hideTerminal(appName) {
  if (platform() == "mac") {
    return await execSync(`osascript -e '${hideTerminalScript(appName)}'`);
  } else if (platform() == "linux") {
  } else if (platform() == "windows") {
  }
}

async function showTerminal(appName) {
  if (platform() == "mac") {
    return await execSync(`osascript -e '${showTerminalScript(appName)}'`);
  } else if (platform() == "linux") {
  } else if (platform() == "windows") {
  }
}

module.exports = {
  focusApplication, hideTerminal, showTerminal
};
