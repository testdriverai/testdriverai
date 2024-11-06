const ipc = require("node-ipc").default;
const { app, screen, BrowserWindow } = require("electron");
const { eventsArray } = require("../lib/events.js");

ipc.config.id = "testdriverai_overlay";
ipc.config.retry = 1500;
ipc.config.silent = true;

app.whenReady().then(() => {
  app.dock?.hide();

  const window = new BrowserWindow({
    ...screen.getPrimaryDisplay().bounds,
    // https://github.com/electron/electron/issues/8141#issuecomment-299668381
    // Allow the window to cover the menu bar on macos
    enableLargerThanScreen: true,
    frame: false,
    show: false,
    closable: false,
    resizable: false,
    focusable: false,
    fullscreen: true,
    fullscreenable: true,
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
  window.setAlwaysOnTop(true, "screen-saver");
  window.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
  });
  window.loadFile("overlay.html");
  window.show();

  // open developer tools
  // window.webContents.openDevTools();

  ipc.serve(() => {
    for (const event of eventsArray) {
      ipc.server.on(event, (data) => {
        window?.webContents.send(event, data);
      });
    }
  });
  ipc.server.on("socket.disconnected", function () {
    process.exit();
  });
  ipc.server.start();
});
