// this file is called by `commands.js` to focus on a window
const path = require("path");
const { execSync } = require("child_process");
const { platform } = require("./system");

// apple script that focuses on a window
const appleScriptShow = (windowName) => `
tell application "System Events" to tell process "${windowName}"
    set frontmost to true
end tell
`;

const appleScriptHide = (windowName) => `
tell application "System Events" to tell process "${windowName}"
    set frontmost to false
end tell
`;

async function focusApplication(appName) {
  try {

    if (platform() == "mac") {
      return await execSync(`osascript -e '${appleScriptShow(appName)}'`);
    } else if (platform() == "linux") {
      // TODO: This needs fixing
      return await execSync(`wmctrl -a '${appName}'`);
    } else if (platform() == "windows") {
      const scriptPath = path.join(__dirname, "focusWindow.ps1");
      return await execSync(`powershell "${scriptPath}" "${appName}"`);
    }

  } catch (error) {
    console.log(error);
  }
}

async function hideTerminal(appName) {
  console.log('hideTerminal');
  try {
    if (platform() == "mac") {
      return await execSync(`osascript -e '${appleScriptHide(appName)}'`);
    } else if (platform() == "linux") {
    } else if (platform() == "windows") {
    }
  } catch (error) {
    console.log(error);
  }
}

async function showTerminal(appName) {
  console.log('show');
  try {

    if (platform() == "mac") {
      return await execSync(`osascript -e '${appleScriptShow(appName)}'`);
    } else if (platform() == "linux") {
    } else if (platform() == "windows") {
    }

  } catch (error) {
    console.log(error);
  }
}

module.exports = {
  focusApplication, hideTerminal, showTerminal
};
