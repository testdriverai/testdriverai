const ipc = require("node-ipc").default;
const { app, screen, BrowserWindow } = require("electron");
const { events } = require("../lib/events.js");

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
    ipc.server.on(events.updateBoundingBoxes, (data) => {
      window?.webContents.send(events.updateBoundingBoxes, data);
    });
    ipc.server.on(events.mouseClick, (data) => {
      window?.webContents.send(events.mouseClick, data);
    });
    ipc.server.on(events.screenCapture.start, (data) => {
      window?.webContents.send(events.screenCapture.start, data);
    });
    ipc.server.on(events.screenCapture.end, (data) => {
      window?.webContents.send(events.screenCapture.end, data);
    });
    ipc.server.on(events.screenCapture.error, (data) => {
      window?.webContents.send(events.screenCapture.end, data);
    });
  });
  ipc.server.start();
});
