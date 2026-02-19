// utilities for getting information about the system
const fs = require("fs");
const os = require("os");
const path = require("path");
const { randomUUID } = require("crypto");
const Jimp = require("jimp");
const { events } = require("../events.js");

const createSystem = (emitter, sandbox, config) => {
  const screenshot = async (options) => {
    let { base64 } = await sandbox.send({
      type: "system.screenshot",
    });

    if (!base64) {
      throw new Error("Failed to take screenshot: sandbox returned empty data");
    }
    
    let image = Buffer.from(base64, "base64");
    
    // Verify we got actual image data (PNG header starts with these bytes)
    if (image.length < 100) {
      throw new Error(`Failed to take screenshot: received only ${image.length} bytes`);
    }
    
    fs.writeFileSync(options.filename, image);
    return { filename: options.filename };
  };

  let primaryDisplay = null;

  const getSystemInformationOsInfo = async () => {
    return {
      os: "windows",
    };
  };

  let countImages = 0;
  const tmpFilename = () => {
    countImages = countImages + 1;
    return path.join(os.tmpdir(), `td-${Date.now()}-${randomUUID().slice(0, 8)}-${countImages}.png`);
  };

  // Lazily query the runner's actual screen size on first screenshot so that
  // TD_RESOLUTION matches the real logical resolution.  This prevents a
  // coordinate-space mismatch on displays whose logical resolution differs
  // from the hardcoded 1366×768 default (e.g. Retina Macs at 1512×982).
  let _screenSizeQueried = false;
  const ensureScreenSizeKnown = async () => {
    if (_screenSizeQueried) return;
    _screenSizeQueried = true;
    try {
      const result = await sandbox.send({ type: "getScreenSize" });
      const out = result.result || result.out || result;
      if (out && out.width && out.height) {
        config.TD_RESOLUTION = [out.width, out.height];
        emitter.emit(
          events.log.debug,
          `[system] Updated TD_RESOLUTION to actual screen size: ${out.width}×${out.height}`,
        );
      }
    } catch (err) {
      // If querying fails, fall back to the configured TD_RESOLUTION
      emitter.emit(
        events.log.debug,
        `[system] Could not query screen size, using default TD_RESOLUTION: ${config.TD_RESOLUTION.join("×")} (${err.message})`,
      );
    }
  };

  const captureAndResize = async (scale = 1, silent = false, mouse = false) => {
    try {
      // Ensure TD_RESOLUTION reflects the actual screen size
      await ensureScreenSizeKnown();

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

      // Load the screenshot image with Jimp
      let image = await Jimp.read(step1);
      
      // Validate the image was loaded correctly (not a 1x1 or tiny placeholder)
      if (image.getWidth() < 10 || image.getHeight() < 10) {
        throw new Error(`Screenshot appears corrupted: got ${image.getWidth()}x${image.getHeight()} pixels`);
      }

      // Resize the image
      image.resize(
        Math.floor(config.TD_RESOLUTION[0] * scale),
        Math.floor(config.TD_RESOLUTION[1] * scale),
      );

      if (mouse) {
        // Only get mouse position when needed to avoid unnecessary websocket calls
        const cursorPath = path.join(__dirname, "resources", "cursor-2.png");
        const mousePos = await getMousePosition();
        
        // Load and composite the mouse cursor image
        const cursorImage = await Jimp.read(cursorPath);
        image.composite(cursorImage, mousePos.x, mousePos.y);
      }

      await image.writeAsync(step2);

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
  const captureScreenBase64 = async (
    scale = 1,
    silent = false,
    mouse = false,
  ) => {
    let step2 = await captureAndResize(scale, silent, mouse);
    return fs.readFileSync(step2, "base64");
  };

  const captureScreenPNG = async (scale = 1, silent = false, mouse = false) => {
    return await captureAndResize(scale, silent, mouse);
  };

  const platform = () => {
    return "windows";
  };

  // this is the focused window
  const activeWin = async () => {
    // Get Mouse Position from command line
    let result = await sandbox.send({
      type: "system.get-active-window",
    });

    return result.out;
  };

  const getMousePosition = async () => {
    // Get Mouse Position from command line
    let result = await sandbox.send({
      type: "system.get-mouse-position",
    });

    return result.out;
  };

  return {
    captureScreenBase64,
    captureScreenPNG,
    getMousePosition,
    primaryDisplay,
    activeWin,
    platform,
    getSystemInformationOsInfo,
  };
};

module.exports = {
  createSystem,
};
