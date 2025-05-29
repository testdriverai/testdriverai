const { default: nodeIPC } = require("node-ipc");
const {
  app: electronApp,
  remote,
  screen,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
} = require("electron");
const { eventsArray, events } = require("../lib/events.js");
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

  // --- Overlay Window (UI) ---
  let overlayWindow;
  let overlayWindowOptions;
  const showOverlayGUI = config.TD_OVERLAY_GUI !== false;
  if (showOverlayGUI) {
    if (config.TD_VM) {
      overlayWindowOptions = {
        width: config.TD_VM_RESOLUTION[0],
        height: config.TD_VM_RESOLUTION[1],
        closable: true,
        resizable: false,
        show: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
        },
        autoHideMenuBar: true,
      };
    } else {
      overlayWindowOptions = {
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
        overlayWindowOptions.fullscreen = true;
      }
    }
    overlayWindow = new BrowserWindow(overlayWindowOptions);
    if (!config.TD_VM) {
      overlayWindow.setIgnoreMouseEvents(true);
      overlayWindow.setAlwaysOnTop(true, "screen-saver");
      overlayWindow.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true,
      });
    } else {
      overlayWindow.setContentSize(
        config.TD_VM_RESOLUTION[0],
        config.TD_VM_RESOLUTION[1],
      );
    }
    overlayWindow.loadFile("overlay.html");
  }

  // --- Terminal Window ---
  let terminalWindow;
  const showOverlayTerminal = config.TD_OVERLAY_TERMINAL !== false;
  if (showOverlayTerminal) {
    terminalWindow = new BrowserWindow({
      width: 600,
      height: (overlayWindowOptions && overlayWindowOptions.height) || 800,
      x:
        (overlayWindowOptions && overlayWindowOptions.width
          ? overlayWindowOptions.width
          : 1920) - 600,
      y: 0,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });
    // terminalWindow.setContentProtection(true);
    terminalWindow.loadFile("overlay-terminal.html");
    terminalWindow.openDevTools({
      mode: "detach",
    });
  }

  // --- Event Routing ---
  ipc.serve(() => {
    for (const event of eventsArray) {
      ipc.server.on(event, (data) => {
        if (event === "show-window") {
          if (showOverlayGUI && overlayWindow) overlayWindow.showInactive();
          if (showOverlayTerminal && terminalWindow)
            terminalWindow.showInactive();
          return;
        }
        if (showOverlayGUI && overlayWindow)
          overlayWindow?.webContents.send(event, data);

        if (showOverlayTerminal && terminalWindow) {
          if (
            event === "screen-capture:start" ||
            event === "mouse-click:start"
          ) {
            console.log("Hiding terminal window for event:", event);
            terminalWindow.hide();
          }
          if (event === "screen-capture:end" || event === "mouse-click:end") {
            console.log("Showing terminal window for event:", event);
            terminalWindow.showInactive();
          }
          terminalWindow?.webContents.send(event, data);
        }
      });
    }
  });

  // Listen for terminal:stdin from renderer and forward to main process (agent.js)
  ipcMain.on(events.terminal.stdin, (event, data) => {
    // Forward stdin data to agent.js via node-ipc (use broadcast, not emit)
    ipc.server.broadcast(events.terminal.stdin, data);
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
