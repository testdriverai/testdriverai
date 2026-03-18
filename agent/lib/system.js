// utilities for getting information about the system
const fs = require("fs");
const os = require("os");
const path = require("path");
const { randomUUID } = require("crypto");
const Jimp = require("jimp");
const axios = require("axios");
const { withRetry } = require("./sdk");
const { events } = require("../events.js");

const createSystem = (emitter, sandbox, config) => {

  // Download a screenshot from S3 when the runner returns an s3Key
  // (large screenshots are uploaded to S3 and referenced by key)
  const downloadFromS3 = async (s3Key) => {
    const apiRoot = config["TD_API_ROOT"] || sandbox.apiRoot;
    const apiKey = sandbox.apiKey;

    // Step 1: Get presigned download URL from API (with retry)
    const response = await withRetry(
      () => axios({
        method: "post",
        url: apiRoot + "/api/v7/runner/download-url",
        data: { apiKey, s3Key },
        headers: { "Content-Type": "application/json" },
        timeout: 15000,
      }),
      {
        retryConfig: { maxRetries: 3, baseDelayMs: 1000 },
      },
    );

    const downloadUrl = response.data.downloadUrl;
    if (!downloadUrl) {
      throw new Error("No downloadUrl in response: " + JSON.stringify(response.data));
    }

    // Step 2: Download the image from S3
    const imageResponse = await axios({
      method: "get",
      url: downloadUrl,
      responseType: "arraybuffer",
      timeout: 30000,
    });

    return Buffer.from(imageResponse.data).toString("base64");
  };

  const screenshot = async (options) => {
    let response = await sandbox.send({
      type: "system.screenshot",
    });

    let base64;

    // Runner returns { s3Key } when screenshots are uploaded to S3
    // Runner returns { base64 } for direct/local connections
    if (response.s3Key) {
      base64 = await downloadFromS3(response.s3Key);
    } else {
      base64 = response.base64;
    }

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

      // Resize the image
      image.resize(
        Math.floor(config.TD_RESOLUTION[0] * scale),
        Math.floor(config.TD_RESOLUTION[1] * scale),
      );

      if (mouse) {
        // Only get mouse position when needed to avoid unnecessary websocket calls
        const cursorPath = path.join(__dirname, "resources", "cursor-2.png");
        const mousePos = await getMousePosition();
        
        // Load and composite the mouse cursor image if we have valid coordinates
        if (mousePos && typeof mousePos.x === "number" && typeof mousePos.y === "number") {
          const cursorImage = await Jimp.read(cursorPath);
          image.composite(cursorImage, mousePos.x, mousePos.y);
        }
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
