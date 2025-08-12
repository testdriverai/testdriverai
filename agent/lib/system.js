// utilities for getting information about the system
const fs = require("fs");
const os = require("os");
const path = require("path");
const Jimp = require("jimp");
const { events } = require("../events.js");

const createSystem = (emitter, sandbox, config) => {
  const screenshot = async (options) => {
    let { base64 } = await sandbox.send({ type: "system.screenshot" });

    if (!base64) {
      console.error("Failed to take screenshot");
    } else {
      let image = Buffer.from(base64, "base64");
      fs.writeFileSync(options.filename, image);
      return { filename: options.filename };
    }
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

      // Location of cursor image
      const cursorPath = path.join(__dirname, "resources", "cursor-2.png");

      const mousePos = await getMousePosition();

      // Load the screenshot image with Jimp
      let image = await Jimp.read(step1);

      // Resize the image
      image.resize(
        Math.floor(config.TD_RESOLUTION[0] * scale),
        Math.floor(config.TD_RESOLUTION[1] * scale),
      );

      if (mouse) {
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
