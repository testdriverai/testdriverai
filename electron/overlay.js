const ipc = require("node-ipc").default;
const { app, screen, BrowserWindow } = require("electron");
const { eventsArray } = require("../lib/events.js");

ipc.config.id = "testdriverai_overlay";
ipc.config.retry = 1500;
ipc.config.silent = true;

app.whenReady().then(() => {
  app.dock?.hide();

  const windowOptions = {
    width: 1030,
    height: 800,
    // ...screen.getPrimaryDisplay().bounds,
    // enableLargerThanScreen: true,
    // frame: false,
    // show: false,
    closable: true,
    resizable: true,
    // focusable: false,
    // fullscreenable: true,
    // transparent: true,
    alwaysOnTop: true,
    // skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true,
  };

  if (process.platform !== 'darwin') {
    windowOptions.fullscreen = true;
  }

  const window = new BrowserWindow(windowOptions);
  // window.setIgnoreMouseEvents(true);
  // window.setAlwaysOnTop(true, "screen-saver");
  // window.setVisibleOnAllWorkspaces(true, {
  //   visibleOnFullScreen: true,
  // });
  window.loadFile("overlay.html");

  window.once('ready-to-show', () => {
    window.showInactive();
  });

  // open developer tools
  window.webContents.openDevTools();

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
