const { default: nodeIPC } = require("node-ipc");
const {
  app: electronApp,
  remote,
  BrowserWindow,
  Tray,
  Menu,
} = require("electron");
const { eventsArray } = require("../lib/events.js");
const config = require("../lib/config.js");
const path = require("path");

let tray = null;

const app = electronApp || remote;
if (!app) {
  exit(1, "No Electron app");
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
  const iconPath = path.join(__dirname, "tray.png");

  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip("TestDriver.ai");
  tray.setContextMenu(contextMenu);

  app.dock?.hide();

  let windowOptions;

  windowOptions = {
    width: config.TD_RESOLUTION[0],
    height: config.TD_RESOLUTION[1],
    closable: true,
    resizable: false,
    // alwaysOnTop: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true,
  };

  const window = new BrowserWindow(windowOptions);

  window.setContentSize(
    config.TD_RESOLUTION[0] + 5,
    config.TD_RESOLUTION[1] + 25,
  );
  window.setBackgroundColor("#000");

  window.loadFile("overlay.html");

  window.once("ready-to-show", () => {
    // window.showInactive();
  });

  // open developer tools
  window.webContents.openDevTools();

  ipc.serve(() => {
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
      exit(0, "IPC No connected clients for 5 minutes");
    },
    1000 * 60 * 5,
  );

  ipc.server.on("connect", () => {
    clearTimeout(timeout);
  });

  ipc.server.on("socket.disconnected", function () {
    // We exit because we want the renderer process to be single use
    // and not stay alive if the cli gets disconnected
    exit(0, "IPC Client disconnected");
  });

  ipc.server.on("error", () => {
    exit(1, "IPC Server error");
  });

  ipc.server.on("destroy", () => {
    exit(1, "IPC Server destroyed");
  });

  ipc.server.start();
});

function exit(code = 0, reason = "") {
  if (code && reason) {
    console.error(`Exiting with code ${code} and reason: "${reason}"`);
  }

  process.exit(code);
}
