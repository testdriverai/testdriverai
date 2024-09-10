// this file is called by `commands.js` to focus on a window
const path = require("path");
const { execSync } = require("child_process");
const { platform } = require("./system");
const scriptPath = path.join(__dirname, "focusWindow.ps1");

// apple script that focuses on a window
const appleScriptShow = (windowName) => `
tell application "${windowName}" to set miniaturized of every window to false
`;

const appleScriptHide = (windowName) => `
tell application "${windowName}" to set miniaturized of every window to true`;

async function focusApplication(appName) {
  try {

    if (platform() == "mac") {
      return await execSync(`osascript -e '${appleScriptShow(appName)}'`);
    } else if (platform() == "linux") {
      // TODO: This needs fixing
      return await execSync(`wmctrl -a '${appName}'`);
    } else if (platform() == "windows") {
      return await execSync(`powershell "${scriptPath}" "${appName}" -Action "Show"`);
    }

  } catch (error) {
    console.log(error);
  }
}

async function hideTerminal(appName) {

  try {
    if (platform() == "mac") {
      return await execSync(`osascript -e '${appleScriptHide(appName)}'`);
    } else if (platform() == "linux") {
    } else if (platform() == "windows") {
      return await execSync(`powershell "${scriptPath}" "${appName}" -Action "Minimize"`);
    }
  } catch (error) {
    console.log(error);
  }
}

async function showTerminal(appName) {
  try {

    if (platform() == "mac") {
      return await execSync(`osascript -e '${appleScriptShow(appName)}'`);
    } else if (platform() == "linux") {
    } else if (platform() == "windows") {
      return await execSync(`powershell "${scriptPath}" "${appName}" -Action "Show"`);
    }

  } catch (error) {
    console.log(error);
  }
}

module.exports = {
  focusApplication, hideTerminal, showTerminal
};
