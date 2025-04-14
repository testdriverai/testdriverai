let platform = require("os").platform();
let exec = require("child_process").exec;
const { execSync } = require("child_process");
const readline = require("readline");

if (platform !== "darwin") {
  console.log("TestDriver Setup: Skipping codesign becasue not on Mac");
  return;
}

console.log("TestDriver Setup: Codesigning terminal-notifier.app");

let signScript = `codesign --sign - --force --deep node_modules/node-notifier/vendor/mac.noindex/terminal-notifier.app`;

exec(signScript, (error, stdout, stderr) => {
  if (error) {
    console.error(`exec error: ${error}`);
    return;
  }
  console.log(`stdout: ${stdout}`);
  console.error(`stderr: ${stderr}`);
});
