// utilities for getting information about the system
const fs = require("fs");
const os = require("os");
const path = require("path");
const { randomUUID } = require("crypto");
const Jimp = require("jimp");
const { events } = require("../events.js");

const createSystem = (emitter, sandbox, config) => {

  // Download a screenshot from S3 when the runner returns an s3Key
  // (screenshots exceed Ably's 64KB message limit)
  const downloadFromS3 = async (s3Key) => {
    const https = require("https");
    const http = require("http");
    const apiRoot = config["TD_API_ROOT"] || sandbox.apiRoot;
    const apiKey = sandbox.apiKey;

    // Step 1: Get presigned download URL from API (with retry on rate-limit)
    const body = JSON.stringify({ apiKey, s3Key });
    const url = new URL(apiRoot + "/api/v7/runner/download-url");
    const transport = url.protocol === "https:" ? https : http;

    const MAX_RETRIES = 3;
    let downloadUrl;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        downloadUrl = await new Promise((resolve, reject) => {
          const req = transport.request(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(body),
              "Connection": "close",
            },
          }, (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => {
              if (res.statusCode === 429) {
                return reject({ retryable: true, message: "Rate limited (429) from download-url endpoint" });
              }
              if (res.statusCode >= 400) {
                return reject(new Error(`download-url request failed (HTTP ${res.statusCode}): ${data}`));
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.downloadUrl) {
                  resolve(parsed.downloadUrl);
                } else {
                  reject(new Error("No downloadUrl in response: " + data));
                }
              } catch (e) {
                reject({ retryable: true, message: "Failed to parse download-url response: " + data });
              }
            });
          });
          req.on("error", reject);
          req.write(body);
          req.end();
        });
        break; // success — exit retry loop
      } catch (err) {
        if (err && err.retryable && attempt < MAX_RETRIES) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw err instanceof Error ? err : new Error(err.message || String(err));
      }
    }

    // Step 2: Download the image from S3
    const imageUrl = new URL(downloadUrl);
    const s3Transport = imageUrl.protocol === "https:" ? https : http;

    const imageBuffer = await new Promise((resolve, reject) => {
      s3Transport.get(downloadUrl, { headers: { "Connection": "close" } }, (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }).on("error", reject);
    });

    return imageBuffer.toString("base64");
  };

  const screenshot = async (options) => {
    let response = await sandbox.send({
      type: "system.screenshot",
    });

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
