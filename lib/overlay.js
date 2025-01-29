import path from 'path';
import ipc from 'node-ipc';
import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import { emitter, eventsArray } from './events.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

ipc.config.id = "testdriverai";
ipc.config.retry = 50;
ipc.config.silent = true;

let electronProcess;

console.log("Spawning GUI...");

try {
  // Resolve the path to Electron CLI
  const electronCliPath = new URL('electron/cli.js', import.meta.url).pathname;

  // Construct the path to the overlay.js script
  const overlayScriptPath = path.join(__dirname, '..', 'electron', 'overlay.js');

  // Fork the Electron process with overlay.js as an argument
  electronProcess = fork(
    electronCliPath,
    [overlayScriptPath],
    { stdio: 'ignore' }
  );

} catch (error) {
  console.error("Failed to locate Electron CLI or start process:", error);
}

export const electronProcessPromise = new Promise((resolve) => {
  ipc.connectTo("testdriverai_overlay");
  ipc.of.testdriverai_overlay.on("connect", () => {
    eventsArray.forEach((event) =>
      emitter.on(event, (data) =>
        ipc.of.testdriverai_overlay.emit(event, data),
      ),
    );
    resolve(electronProcess);
  });
});
