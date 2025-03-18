// utilities for getting information about the system
const fs = require("fs");
const os = require("os");
const path = require("path");
const si = require("systeminformation");
const robot = require("robotjs");
const sharp = require("sharp");
const { emitter, events } = require("./events.js");
const sandbox = require("./sandbox.js");
const config = require("./config.js");

let scshotdesk;
if (!config.TD_VM) {
  scshotdesk = require("screenshot-desktop");
}

const screenshot = async (options) => {

  if (config.TD_VM) {
    let {base64} = await sandbox.send({type: 'screenshot'});
    let image = Buffer.from(base64, 'base64');
    fs.writeFileSync(options.filename, image);
  } else {
    return await scshotdesk({ filename: options.filename, format: "png" });
  }
}

let primaryDisplay = null;

// get the primary display
// this is the only display we ever target, because fuck it
// the vm only has one and most people only have one
const getPrimaryDisplay = async () => {
  // calculate scaling resolution
  let graphics = await si.graphics();
  let primaryDisplay = graphics.displays.find(
    (display) => display.main == true,
  );

  return primaryDisplay;
};

const getSystemInformationOsInfo = async () => {
  if (config.TD_VM) {
    return {
      os: 'linux'
    }
  } else {
    return await si.osInfo();
  }
};

let countImages = 0;
const tmpFilename = () => {
  countImages = countImages + 1;
  return path.join(os.tmpdir(), `${new Date().getTime() + countImages}.png`);
};

const captureAndResize = async (scale = 1, silent = false, mouse = false) => {
  try {

    if (!silent) {
      emitter.emit(events.screenCapture.start, {
        scale,
        silent,
        display: primaryDisplay,
      });
    }

    let step1 = tmpFilename();
    let step2 = tmpFilename();

    await screenshot({ filename: step1, format: "png" });

    let sharpInstance;
    if (config.TD_VM) {

      // resize to 1:1 px ratio
      sharpInstance = sharp(step1).resize(
        Math.floor(1024 * scale),
        Math.floor(768 * scale),
      );

    } else {

      const primaryDisplay = await getPrimaryDisplay();
      
      sharpInstance = sharp(step1).resize(
        Math.floor(primaryDisplay.currentResX * scale),
        Math.floor(primaryDisplay.currentResY * scale),
      );

      // Fetch the mouse position
      const mousePos = robot.getMousePos();

      // Location of cursor image
      const cursorPath = path.join(__dirname, "resources", "cursor.png");

      if (mouse) {
        // composite the mouse image ontop
        sharpInstance.composite([{ input: cursorPath, left: mousePos.x, top: mousePos.y }]);
      }

    }

    await sharpInstance.toFile(step2);

    emitter.emit(events.screenCapture.end, {
      scale,
      silent,
      display: primaryDisplay,
    });

    return step2;
  } catch (error) {
    emitter.emit(events.screenCapture.error, {
      error,
      scale,
      silent,
      display: primaryDisplay,
    });
    throw error;
  }
};

// our handy screenshot function
const captureScreenBase64 = async (scale = 1, silent = false, mouse = false) => {
  let step2 = await captureAndResize(scale, silent, mouse);
  return fs.readFileSync(step2, "base64");
};

const captureScreenPNG = async (scale = 1, silent = false, mouse = false) => {
  return await captureAndResize(scale, silent, mouse);
};

const platform = () => {
  let platform = process.platform;
  if (platform === "darwin") {
    platform = "mac";
  } else if (platform === "win32") {
    platform = "windows";
  } else if (platform === "linux") {
    platform = "linux";
  } else {
    throw new Error("Unsupported platform");
  }
  return platform;
};

// Import get-windows using dynamic import for ES module compatibility
let activeWindowFn = null;
const initializeActiveWindow = async () => {
  if (!activeWindowFn && !config.TD_VM) {
    const { activeWindow } = await import('get-windows');
    activeWindowFn = activeWindow;
  }
  return activeWindowFn;
};

// this is the focused window
const activeWin = async () => {
  
  if (config.TD_VM) { 
    
  return "error getting active window, proceed normally";

  } else {

    try {
      const activeWindow = await initializeActiveWindow();
      return await activeWindow();
    } catch (error) {
      logger.error('Error getting active window: %s', error);
      return null;
    }

  }
};

const getMousePosition = async () => {
  return await robot.getMousePos();
};

module.exports = {
  getPrimaryDisplay,
  captureScreenBase64,
  captureScreenPNG,
  getMousePosition,
  primaryDisplay,
  activeWin,
  platform,
  getSystemInformationOsInfo,
};
