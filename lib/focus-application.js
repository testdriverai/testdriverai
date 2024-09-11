// this file is called by `commands.js` to focus on a window
const path = require("path");
const { execSync } = require("child_process");
const { platform } = require("./system");
const scriptPath = path.join(__dirname, "focusWindow.ps1");

// apple script that focuses on a window
const appleScriptFocus = (windowName) => `
tell application "System Events" to tell process "${windowName}"
    set frontmost to true
end tell`;

const appleScriptMinMax = (windowName, booleanString) => `
tell application "${windowName}"
    set windowList to every window
    repeat with aWindow in windowList
        set miniaturized of aWindow to ${booleanString}
    end repeat
end tell
`;

async function focusApplication(appName) {
  try {

    if (platform() == "mac") {
      return await execSync(`osascript -e '${appleScriptFocus(appName)}'`);
    } else if (platform() == "linux") {
      // TODO: This needs fixing
      return await execSync(`wmctrl -a '${appName}'`);
    } else if (platform() == "windows") {
      return await execSync(`powershell -ExecutionPolicy RemoteSigned -File "${scriptPath}" "${appName}" "focus"`);
    }

  } catch (error) {
    console.log(error);
  }
}

async function hideTerminal(appName) {

  try {
    if (platform() == "mac") {
      return await execSync(`osascript -e '${appleScriptMinMax(appName, 'true')}'`);
    } else if (platform() == "linux") {
    } else if (platform() == "windows") {
      return await execSync(`powershell "${scriptPath}" "${appName}" "minimize"`);
    }
  } catch (error) {
    console.log(error);
  }
}

async function showTerminal(appName) {
  try {

    if (platform() == "mac") {
      return await execSync(`osascript -e '${appleScriptMinMax(appName, 'false')}'`);
    } else if (platform() == "linux") {
    } else if (platform() == "windows") {
      return await execSync(`powershell "${scriptPath}" "${appName}" "restore"`);
    }

  } catch (error) {
    console.log(error);
  }
}

module.exports = {
  focusApplication, hideTerminal, showTerminal
};
