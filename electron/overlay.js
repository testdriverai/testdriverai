const { default: nodeIPC } = require("node-ipc");
const { app: electronApp, remote, screen, BrowserWindow, Tray, Menu } = require("electron");
const { eventsArray } = require("../lib/events.js");
const config = require("../lib/config.js");
const path = require('path');

let tray = null;

const app = electronApp || remote;
if (!app) {
  console.log("No app");
  process.exit(1);
}

// Seems like the direct process id is not the electron process id
// so we use the parent process id
const rendererId = process.env.TD_OVERLAY_ID ?? process.ppid;

const ipc = new nodeIPC.IPC();
ipc.config.id = `testdriverai_overlay_${rendererId}`;
ipc.config.retry = 0;
ipc.config.silent = true;

app.whenReady().then(() => {

  // Path to tray icon (must be .ico on Windows, .png on Mac/Linux)
  const iconPath = path.join(__dirname, 'tray.png');

  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('TestDriver.ai');
  tray.setContextMenu(contextMenu);

  app.dock?.hide();

  let windowOptions;

  if (config.TD_VM) {
    windowOptions = {
      width: config.TD_VM_RESOLUTION[0],
      height: config.TD_VM_RESOLUTION[1],
      closable: true,
      resizable: true,
      // alwaysOnTop: true,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
      autoHideMenuBar: true,
      fullscreen: config.TD_VM_FULLSCREEN,
    };
  } else {
    windowOptions = {
      ...screen.getPrimaryDisplay().bounds,
      closable: true,
      resizable: true,
      alwaysOnTop: true,
      enableLargerThanScreen: true,
      frame: false,
      show: false,
      focusable: false,
      fullscreenable: true,
      transparent: true,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
      autoHideMenuBar: true,
    };

    if (process.platform !== "darwin") {
      windowOptions.fullscreen = true;
    }
  }

  const window = new BrowserWindow(windowOptions);

  if (!config.TD_VM) {
    window.setIgnoreMouseEvents(true);
    window.setAlwaysOnTop(true, "screen-saver");
    window.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
    });
  } else {
    window.setContentSize(config.TD_VM_RESOLUTION[0], config.TD_VM_RESOLUTION[1]);
    window.setBackgroundColor('#000')
  }

  window.loadFile("overlay.html");

  window.once("ready-to-show", () => {
    // window.showInactive();
  });

  // open developer tools
  // window.webContents.openDevTools();

  ipc.serve(() => {
    console.log("Serving IPC");
    for (const event of eventsArray) {
      ipc.server.on(event, (data) => {
        if (event === "show-window") {
          window.showInactive();
          return;
        }
        window?.webContents.send(event, data);
      });
    }
  });

  // We do this because node-ipc doesn't prevent new servers from using the same id
  // so we need to timeout if no clients connect after 5 minutes to avoid keeping older
  // overlay processes alive
  const timeout = setTimeout(
    () => {
      console.log("No connected clients for 5 minutes");
      process.exit(0);
    },
    1000 * 60 * 5,
  );

  ipc.server.on("connect", () => {
    console.log("Client connected");
    clearTimeout(timeout);
  });

  ipc.server.on("socket.disconnected", function () {
    // We exit because we want the renderer process to be single use
    // and not stay alive if the cli gets disconnected
    console.log("Client disconnected");
    process.exit();
  });

  ipc.server.on("error", () => {
    console.log("Server error");
    process.exit(1);
  });

  ipc.server.on("destroy", () => {
    console.log("Server destroyed");
    process.exit(1);
  });

  ipc.server.start();
});
