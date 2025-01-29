// this file is called by `commands.js` to focus on a window
import path from 'path';
import { execSync } from 'child_process';
import { platform } from './system.js';
import robot from 'robotjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.join(__dirname, "focusWindow.ps1");

// apple script that focuses on a window
const appleScriptSetFrontmost = (windowName) => `
tell application "System Events" to tell process "${windowName}"
    set frontmost to true
end tell`;

// const appleScriptAXMinimized = (windowName) => `
// tell application "System Events" 
//     set value of attribute "AXMinimized" of every window of application process "${windowName}" to true
// end tell`;

const appleScriptActivate = (windowName) => `
tell application id "${windowName}"
    set miniaturized of every window to false
    reopen
    activate
end tell
`;

const runPwsh = (appName, method) => {
  let script = `powershell -ExecutionPolicy Bypass -Command "& { ${scriptPath} '${appName}' '${method}' }"`;
  return execSync(script, { shell: "powershell" });
};

async function focusApplication(appName) {
  try {
    if (platform() == "mac") {
      return await execSync(`osascript -e '${appleScriptSetFrontmost(appName)}'`);
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
      robot.keyTap('m', ['command']);
      robot.keyToggle('command', 'up')
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
      return await execSync(`osascript -e '${appleScriptActivate(appName)}'`);
    } else if (platform() == "windows") {
      return runPwsh(appName, "Restore");
    }
  } catch (error) {
    console.log(error);
  }
}

export {
  focusApplication,
  hideTerminal,
  showTerminal,
};
