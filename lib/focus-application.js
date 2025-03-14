// this file is called by `commands.js` to focus on a window
const path = require("path");
const { execSync } = require("child_process");
const { platform } = require("./system");
const scriptPath = path.join(__dirname, "focusWindow.ps1");
const robot = require("robotjs");
const { logger } = require("./logger");
const sandbox = require("./sandbox");

async function focusVSCode() {

  try {
    
    if (platform() == "mac") {
      return await execSync('open -a "Visual Studio Code"');
    } else {
      return await execSync('"C:\\Program Files\\Microsoft VS Code\\Code.exe"');
    }
  } catch (error) {
    logger.error(error);
  }

}

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
    set frontmost to true
    set miniaturized of every window to false
    reopen
    windows where title contains "bash"
    if result is not {} then perform action "AXRaise" of item 1 of result
end tell
`;

const runPwsh = (appName, method) => {
  let script = `powershell -ExecutionPolicy Bypass -Command "& { ${scriptPath} '${appName}' '${method}' }"`;
  return execSync(script, { shell: "powershell" });
};

async function focusApplication(appName) {
  try {
    // if (platform() == "mac") {
    //   return await execSync(`osascript -e '${appleScriptSetFrontmost(appName)}'`);
    // } else if (platform() == "linux") {
    //   // TODO: This needs fixing
    //   return;
    // } else if (platform() == "windows") {
    //   return runPwsh(appName, "Focus");
    // }
    console.log('running', 'wmctrl -a ' + appName)

    const out = await sandbox.getDesktop().commands.run('wmctrl -a ' + appName)
    console.log(out);
  } catch (error) {
    logger.error(error);
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
    logger.error(error);
  }
}

async function showTerminal(appName) {
  try {
    if (platform() == "mac") {
      focusVSCode();
      appleScriptActivate(appName);
    } else if (platform() == "windows") {
      return runPwsh(appName, "Restore");
    }
  } catch (error) {
    logger.error(error);
  }
}

module.exports = {
  focusApplication,
  hideTerminal,
  showTerminal,
};
