// utilities for getting information about the system
const fs = require("fs");
const os = require("os");
const path = require("path");
const { randomUUID } = require("crypto");
const Jimp = require("jimp");
const { events } = require("../events.js");

const createSystem = (emitter, sandbox, config) => {
  const screenshot = async (options) => {
    let result = await sandbox.send({
      type: "system.screenshot",
    });

    // Runner now returns { s3Key } instead of { base64 } to avoid Ably size limits
    if (result.s3Key) {
      // Download from S3 and save to file (s3Key as query param to avoid slash issues in URL path)
      let s3Url = `${config.TD_API_ROOT}/api/v7/runner/download?s3Key=${encodeURIComponent(result.s3Key)}&apiKey=${encodeURIComponent(config.TD_API_KEY)}`;
      if (sandbox.sandboxId) {
        s3Url += `&sandboxId=${encodeURIComponent(sandbox.sandboxId)}`;
      }
      const response = await fetch(s3Url);
      if (!response.ok) {
        throw new Error(`Failed to download screenshot from S3: ${response.status}`);
      }
      const buffer = await response.arrayBuffer();
      const buf = Buffer.from(buffer);
      fs.writeFileSync(options.filename, buf);

      // Debug: save raw S3 screenshot and log path
      try {
        const debugDir = path.join(os.tmpdir(), 'testdriver-screenshots', 'sdk');
        fs.mkdirSync(debugDir, { recursive: true });
        const debugPath = path.join(debugDir, `s3-raw-${Date.now()}.png`);
        fs.writeFileSync(debugPath, buf);
        console.log(`[system] DEBUG: Raw S3 screenshot saved: ${debugPath} (${buf.length} bytes)`);
      } catch (e) {
        console.warn(`[system] DEBUG: Failed to save raw screenshot: ${e.message}`);
      }

      return { filename: options.filename };
    }
    
    // Fallback: old base64 format (for backward compatibility)
    if (result.base64) {
      let image = Buffer.from(result.base64, "base64");
      if (image.length < 100) {
        throw new Error(`Failed to take screenshot: received only ${image.length} bytes`);
      }
      fs.writeFileSync(options.filename, image);
      return { filename: options.filename };
    }
    
    throw new Error("Failed to take screenshot: sandbox returned empty data");
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

      // Load the screenshot image with Jimp
      let image = await Jimp.read(step1);
      
      // Validate the image was loaded correctly (not a 1x1 or tiny placeholder)
      if (image.getWidth() < 10 || image.getHeight() < 10) {
        throw new Error(`Screenshot appears corrupted: got ${image.getWidth()}x${image.getHeight()} pixels`);
      }

      const origWidth = image.getWidth();
      const origHeight = image.getHeight();
      const targetWidth = Math.floor(config.TD_RESOLUTION[0] * scale);
      const targetHeight = Math.floor(config.TD_RESOLUTION[1] * scale);
      console.log(`[system] Screenshot from runner: ${origWidth}x${origHeight}, resizing to ${targetWidth}x${targetHeight} (TD_RESOLUTION=${config.TD_RESOLUTION}, scale=${scale})`);

      // Resize the image
      image.resize(targetWidth, targetHeight);

      if (mouse) {
        // Only get mouse position when needed to avoid unnecessary websocket calls
        const cursorPath = path.join(__dirname, "resources", "cursor-2.png");
        const mousePos = await getMousePosition();
        
        // Load and composite the mouse cursor image
        const cursorImage = await Jimp.read(cursorPath);
        image.composite(cursorImage, mousePos.x, mousePos.y);
      }

      await image.writeAsync(step2);

      // Debug: save resized screenshot and log path
      try {
        const debugDir = path.join(os.tmpdir(), 'testdriver-screenshots', 'sdk');
        fs.mkdirSync(debugDir, { recursive: true });
        const debugPath = path.join(debugDir, `resized-${Date.now()}.png`);
        fs.copyFileSync(step2, debugPath);
        console.log(`[system] DEBUG: Resized screenshot saved: ${debugPath} (${origWidth}x${origHeight} -> ${targetWidth}x${targetHeight})`);
      } catch (e) {
        console.warn(`[system] DEBUG: Failed to save resized screenshot: ${e.message}`);
      }

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
