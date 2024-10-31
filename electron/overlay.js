const ipc = require("node-ipc").default;
const { app, screen, BrowserWindow } = require("electron");
const { eventsArray } = require("../lib/events.js");

ipc.config.id = "testdriverai_overlay";
ipc.config.retry = 1500;
ipc.config.silent = true;

app.whenReady().then(() => {
  const window = new BrowserWindow({
    ...screen.getPrimaryDisplay().bounds,
    frame: false,
    closable: false,
    resizable: false,
    focusable: false,
    fullscreen: true,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true,
  });
  window.setIgnoreMouseEvents(true);
  window.loadFile("overlay.html");

  ipc.serve(() => {
    for (const event of eventsArray) {
      ipc.server.on(event, (data) => {
        window?.webContents.send(event, data);
      });
    }
  });
  ipc.server.start();
});
