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


const appleScriptMin = (windowName) => `
tell application "System Events" 
    set value of attribute "AXMinimized" of every window of application process "${windowName}" to true
end tell
`;

const appleScriptMax = (windowName) => `
tell application "${windowName}" to activate
`;

const runPwsh = (appName, method) => {
  let script = `powershell -ExecutionPolicy Bypass -Command "& { ${scriptPath} '${appName}' '${method}' }"`;
  return execSync(script, { shell: "powershell" });
};

async function focusApplication(appName) {
  try {
    if (platform() == "mac") {
      return await execSync(`osascript -e '${appleScriptFocus(appName)}'`);
    } else if (platform() == "linux") {
      // TODO: This needs fixing
      return;
    } else if (platform() == "windows") {
      return runPwsh(appName, "Focus");
    }
  } catch (error) {
    console.log(error);
  }
}

async function hideTerminal(appName) {
  try {
    if (platform() == "mac") {
      return await execSync(`osascript -e '${appleScriptMin(appName)}'`);
    } else if (platform() == "linux") {
    } else if (platform() == "windows") {
      return runPwsh(appName, "Minimize");
    }
  } catch (error) {
    console.log(error);
  }
}

async function showTerminal(appName) {
  try {
    if (platform() == "mac") {
      return await execSync(`osascript -e '${appleScriptMax(appName)}'`);
    } else if (platform() == "linux") {
    } else if (platform() == "windows") {
      return runPwsh(appName, "Restore");
    }
  } catch (error) {
    console.log(error);
  }
}

module.exports = {
  focusApplication,
  hideTerminal,
  showTerminal,
};
