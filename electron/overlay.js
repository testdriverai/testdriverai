const ipc = require("node-ipc").default;
const { app, screen, BrowserWindow } = require("electron");
const { eventsArray } = require("../lib/events.js");

ipc.config.id = "testdriverai_overlay";
ipc.config.retry = 1500;
ipc.config.silent = true;

app.whenReady().then(() => {
  app.dock?.hide();

  // get electron workarea size
  let workAreaSize = screen.getPrimaryDisplay().workAreaSize;

  // get dispaly size
  let displaySize = screen.getPrimaryDisplay().size;

  // calculate difference between display and workarea

  let diff = displaySize.height - workAreaSize.height;

  const window = new BrowserWindow({
    ...workAreaSize,
    frame: false,
    show: false,
    closable: false,
    resizable: false,
    focusable: false,
    fullscreen: true,
    fullscreenable: false,
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
  // window.setContentProtection(true);

  window.setAlwaysOnTop(true, "screen-saver");
  window.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
  });
  window.setIgnoreMouseEvents(true);
  window.loadFile("overlay.html");
  window.show();

  // open developer tools
  window.webContents.openDevTools();

  setInterval(() => {
    window?.webContents.send('config', {
      menubarSize: diff
    });
  }, 1000);

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


