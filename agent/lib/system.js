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
  // (screenshots exceed Ably's 64KB message limit)
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

    // Step 2: Download the image from S3 (with retry)
    // Short timeout + many retries: fail fast on stuck connections,
    // and give Tigris time to replicate the object between attempts
    const imageResponse = await withRetry(
      () => axios({
        method: "get",
        url: downloadUrl,
        responseType: "arraybuffer",
        timeout: 10000,
      }),
      {
        retryConfig: { maxRetries: 3, baseDelayMs: 1000 },
      },
    );

    return Buffer.from(imageResponse.data).toString("base64");
  };

  // Capture a screenshot from the runner. Returns the raw runner response,
  // which is one of:
  //   { s3Key, width, height } — runner uploaded to S3 (Ably 64KB limit)
  //   { base64 }               — direct/local connection, bytes inline
  const captureRaw = async () => {
    return await sandbox.send({
      type: "system.screenshot",
    });
  };

  const screenshot = async (options, rawResponse) => {
    const MAX_RETRIES = 3;
    let lastError;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Reuse a response captured by the caller (so the key path and the
        // base64 path don't each trigger a separate runner capture); otherwise
        // capture fresh.
        let response = attempt === 0 && rawResponse
          ? rawResponse
          : await captureRaw();

        let base64;

        // Runner returns { s3Key } for Ably (screenshots too large for 64KB limit)
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
      } catch (error) {
        lastError = error;
        if (attempt < MAX_RETRIES) {
          const delay = 1000 * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
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

  const captureAndResize = async (scale = 1, silent = false, mouse = false, rawResponse = null) => {
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

      await screenshot({ filename: step1, format: "png" }, rawResponse);

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

  // Build the image payload to send to the API for a command (find/assert/etc).
  //
  // Fast path: when the runner uploaded the screenshot to S3 and it was already
  // captured at the requested resolution, return { imageKey } so the API reads
  // the bytes straight from S3 by key. This skips the redundant round-trip the
  // base64 path pays per command — SDK download from S3, Jimp re-encode, then a
  // re-upload on the API side.
  //
  // Slow path (fallback): when bytes are inline (local/direct connection), when
  // a mouse cursor must be composited, when scale != 1, or when the captured
  // size differs from TD_RESOLUTION (so a resize is actually required), fall
  // back to capturing + resizing locally and return { image } (base64).
  const captureScreenImage = async (scale = 1, silent = false, mouse = false) => {
    const raw = await captureRaw();

    const [targetW, targetH] = config.TD_RESOLUTION || [];
    const canUseKey =
      raw &&
      raw.s3Key &&
      !mouse &&
      scale === 1 &&
      typeof raw.width === "number" &&
      typeof raw.height === "number" &&
      raw.width === targetW &&
      raw.height === targetH;

    if (canUseKey) {
      if (!silent) {
        emitter.emit(events.screenCapture.start, { scale, silent, display: primaryDisplay });
        emitter.emit(events.screenCapture.end, { scale, silent, display: primaryDisplay });
      }
      return { imageKey: raw.s3Key };
    }

    // Fallback: download/resize locally and send base64. Pass the already
    // captured runner response through so we don't capture the screen twice.
    const step2 = await captureAndResize(scale, silent, mouse, raw);
    return { image: fs.readFileSync(step2, "base64") };
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
    captureScreenImage,
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
