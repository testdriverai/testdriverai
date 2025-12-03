// Auto-load environment variables from .env file if it exists
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { formatter } = require("./sdk-log-formatter");

/**
 * Get the file path of the caller (the file that called TestDriver)
 * @returns {string|null} File path or null if not found
 */
function getCallerFilePath() {
  const originalPrepareStackTrace = Error.prepareStackTrace;
  try {
    const err = new Error();
    Error.prepareStackTrace = (_, stack) => stack;
    const stack = err.stack;
    Error.prepareStackTrace = originalPrepareStackTrace;

    // Look for the first file that's not sdk.js, hooks.mjs, or node internals
    for (const callSite of stack) {
      const fileName = callSite.getFileName();
      if (fileName && 
          !fileName.includes('sdk.js') && 
          !fileName.includes('hooks.mjs') &&
          !fileName.includes('hooks.js') &&
          !fileName.includes('node_modules') &&
          !fileName.includes('node:internal') &&
          fileName !== 'evalmachine.<anonymous>') {
        return fileName;
      }
    }
  } catch (error) {
    // Silently fail and return null
  } finally {
    Error.prepareStackTrace = originalPrepareStackTrace;
  }
  return null;
}

/**
 * Generate a hash of the caller file for use as a cache key
 * @returns {string|null} Hash of the file or null if file not found
 */
function getCallerFileHash() {
  const filePath = getCallerFilePath();
  if (!filePath) {
    return null;
  }

  try {
    // Handle file:// URLs by converting to file system path
    let fsPath = filePath;
    if (filePath.startsWith('file://')) {
      fsPath = filePath.replace('file://', '');
    }
    
    const fileContent = fs.readFileSync(fsPath, 'utf-8');
    const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
    // Return first 16 chars of hash for brevity
    return hash.substring(0, 16);
  } catch (error) {
    // If we can't read the file, return null
    return null;
  }
}

/**
 * Custom error class for element operation failures
 * Includes debugging information like screenshots and AI responses
 */
class ElementNotFoundError extends Error {
  constructor(message, debugInfo = {}) {
    super(message);
    this.name = "ElementNotFoundError";
    // Sanitize aiResponse to remove base64 images before storing
    this.aiResponse = this._sanitizeAiResponse(debugInfo.aiResponse);
    this.description = debugInfo.description;
    this.timestamp = new Date().toISOString();
    this.screenshotPath = null;

    // Capture stack trace but skip internal frames
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ElementNotFoundError);
    }

    // Write screenshot to temp directory immediately (don't store on error object)
    // This prevents vitest from serializing huge base64 strings
    if (debugInfo.screenshot) {
      try {
        const tempDir = path.join(os.tmpdir(), "testdriver-debug");
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const filename = `screenshot-${Date.now()}.png`;
        this.screenshotPath = path.join(tempDir, filename);

        // Remove data:image/png;base64, prefix if present
        const base64Data = debugInfo.screenshot.replace(
          /^data:image\/\w+;base64,/,
          "",
        );
        const buffer = Buffer.from(base64Data, "base64");

        fs.writeFileSync(this.screenshotPath, buffer);
      } catch {
        // If screenshot save fails, don't break the error
        // Can't emit from constructor, just skip logging
      }
    }

    // Save cached image if available
    this.cachedImagePath = null;
    if (debugInfo.cachedImageUrl) {
      this.cachedImagePath = debugInfo.cachedImageUrl;
    }

    // Save pixel diff image if available
    this.pixelDiffPath = null;
    if (debugInfo.pixelDiffImage) {
      try {
        const tempDir = path.join(os.tmpdir(), "testdriver-debug");
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const filename = `pixel-diff-error-${Date.now()}.png`;
        this.pixelDiffPath = path.join(tempDir, filename);

        const base64Data = debugInfo.pixelDiffImage.replace(
          /^data:image\/\w+;base64,/,
          "",
        );
        const buffer = Buffer.from(base64Data, "base64");

        fs.writeFileSync(this.pixelDiffPath, buffer);
      } catch {
        // Silently skip logging error from constructor
      }
    }

    // Extract similarity and input text from AI response
    const similarity = this.aiResponse?.similarity ?? null;
    const cacheHit =
      this.aiResponse?.cacheHit ?? this.aiResponse?.cached ?? false;
    const cacheStrategy = this.aiResponse?.cacheStrategy ?? null;
    const cacheCreatedAt = this.aiResponse?.cacheCreatedAt ?? null;
    const cacheDiffPercent = this.aiResponse?.cacheDiffPercent ?? null;
    const threshold = debugInfo.threshold ?? null;
    const inputText =
      this.aiResponse?.input_text ?? this.aiResponse?.element ?? null;

    // Enhance error message with debugging hints
    this.message += `\n\n=== Debug Information ===`;
    this.message += `\nElement searched for: "${this.description}"`;

    if (threshold !== null) {
      const similarityRequired = ((1 - threshold) * 100).toFixed(1);
      this.message += `\nCache threshold: ${threshold} (${similarityRequired}% similarity required)`;
    }

    if (cacheHit) {
      this.message += `\nCache: HIT`;
      if (cacheStrategy) {
        this.message += ` (${cacheStrategy} strategy)`;
      }
      if (cacheCreatedAt) {
        const cacheAge = Math.round(
          (Date.now() - new Date(cacheCreatedAt).getTime()) / 1000,
        );
        this.message += `\nCache created: ${new Date(cacheCreatedAt).toISOString()} (${cacheAge}s ago)`;
      }
      if (cacheDiffPercent !== null) {
        this.message += `\nCache pixel diff: ${(cacheDiffPercent * 100).toFixed(2)}%`;
      }
    } else {
      this.message += `\nCache: MISS`;
    }

    if (similarity !== null) {
      const similarityPercent = (similarity * 100).toFixed(2);
      this.message += `\nSimilarity score: ${similarityPercent}%`;

      if (threshold !== null && similarity < 1 - threshold) {
        this.message += ` (below threshold)`;
      }
    }

    if (inputText) {
      this.message += `\nInput text: "${inputText}"`;
    }

    if (this.screenshotPath) {
      this.message += `\nCurrent screenshot: ${this.screenshotPath}`;
    }

    if (this.cachedImagePath) {
      this.message += `\nCached image URL: ${this.cachedImagePath}`;
    }

    if (this.pixelDiffPath) {
      this.message += `\nPixel diff image: ${this.pixelDiffPath}`;
    }

    if (this.aiResponse) {
      const responseText =
        this.aiResponse.response?.content?.[0]?.text ||
        this.aiResponse.content?.[0]?.text ||
        "No detailed response available";
      this.message += `\n\nAI Response:\n${responseText}`;
    }

    // Clean up stack trace to only show userland code
    if (this.stack) {
      const lines = this.stack.split("\n");
      const filteredLines = [lines[0]]; // Keep error message line

      // Skip frames until we find userland code (not sdk.js internals)
      let foundUserland = false;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        // Skip internal Element method frames (click, hover, etc.)
        if (
          line.includes("Element.click") ||
          line.includes("Element.hover") ||
          line.includes("Element.doubleClick") ||
          line.includes("Element.rightClick") ||
          line.includes("Element.mouseDown") ||
          line.includes("Element.mouseUp")
        ) {
          continue;
        }

        // Once we hit userland code, include everything from there
        if (!line.includes("sdk.js") || foundUserland) {
          foundUserland = true;
          filteredLines.push(line);
        }
      }

      this.stack = filteredLines.join("\n");
    }
  }

  /**
   * Sanitize AI response by removing large base64 data to prevent serialization issues
   * @private
   * @param {Object} response - AI response
   * @returns {Object} Sanitized response
   */
  _sanitizeAiResponse(response) {
    if (!response) return null;

    // Create shallow copy and remove large base64 fields
    const sanitized = { ...response };
    delete sanitized.croppedImage;
    delete sanitized.screenshot;
    delete sanitized.pixelDiffImage;
    // Keep cachedImageUrl as it's just a URL string, not base64 data

    return sanitized;
  }
}

/**
 * Element class representing a located or to-be-located element
 */
class Element {
  constructor(description, sdk, system, commands) {
    this.description = description;
    this.sdk = sdk;
    this.system = system;
    this.commands = commands;
    this.coordinates = null;
    /* The above code is a JavaScript comment block that sets the `_found` property of an object to
    `false`. The code snippet does not contain any executable code, it is just a comment. */
    this._found = false;
    this._response = null;
    this._screenshot = null;
    this._threshold = null; // Store the threshold used for this find
  }

  /**
   * Check if element was found
   * @returns {boolean} True if element coordinates were located
   */
  found() {
    return this._found;
  }

  /**
   * Find the element on screen
   * @param {string} [newDescription] - Optional new description to search for
   * @param {Object} [options] - Optional options object with cacheThreshold and/or cacheKey
   * @returns {Promise<Element>} This element instance
   */
  async find(newDescription, options) {
    const description = newDescription || this.description;
    if (newDescription) {
      this.description = newDescription;
    }

    const startTime = Date.now();
    let response = null;
    let findError = null;

    const debugMode =
      process.env.VERBOSE || process.env.DEBUG || process.env.TD_DEBUG;

    // Log finding action
    const { events } = require("./agent/events.js");
    const findingMessage = formatter.formatElementFinding(description);
    this.sdk.emitter.emit(events.log.log, findingMessage);

    try {
      const screenshot = await this.system.captureScreenBase64();
      // Only store screenshot in DEBUG mode to prevent memory leaks
      if (debugMode) {
        this._screenshot = screenshot;
      }

      // Handle options - can be a number (cacheThreshold) or object with cacheKey/cacheThreshold
      let cacheKey = null;
      let cacheThreshold = null;
      
      if (typeof options === 'number') {
        // Legacy: options is just a number threshold
        cacheThreshold = options;
      } else if (typeof options === 'object' && options !== null) {
        // New: options is an object with cacheKey and/or cacheThreshold
        cacheKey = options.cacheKey || null;
        cacheThreshold = options.cacheThreshold ?? null;
      }

      // Use default cacheKey from SDK constructor if not provided in find() options
      if (!cacheKey && this.sdk.options?.cacheKey) {
        cacheKey = this.sdk.options.cacheKey;
      }

      // Determine threshold: 
      // - If cacheKey is provided, enable cache (threshold = 0.05 or custom)
      // - If no cacheKey, disable cache (threshold = -1) unless explicitly overridden
      let threshold;
      if (cacheKey) {
        // cacheKey provided - enable cache with threshold
        threshold = cacheThreshold ?? 0.05;
      } else if (cacheThreshold !== null) {
        // Explicit threshold provided without cacheKey
        threshold = cacheThreshold;
      } else {
        // No cacheKey, no explicit threshold - use global default (which is -1 now)
        threshold = this.sdk.cacheThresholds?.find ?? -1;
      }

      // Store the threshold for debugging
      this._threshold = threshold;

      // Debug log threshold
      if (debugMode) {
        const { events } = require("./agent/events.js");
        const autoGenMsg = (this.sdk._autoGeneratedCacheKey && cacheKey === this.sdk.options.cacheKey) 
          ? ' (auto-generated from file hash)' 
          : '';
        this.sdk.emitter.emit(
          events.log.debug,
          `🔍 find() threshold: ${threshold} (cache ${threshold < 0 ? "DISABLED" : "ENABLED"}${cacheKey ? `, cacheKey: ${cacheKey}${autoGenMsg}` : ""})`,
        );
      }

      response = await this.sdk.apiClient.req("find", {
        session: this.sdk.getSessionId(),
        element: description,
        image: screenshot,
        threshold: threshold,
        cacheKey: cacheKey,
        os: this.sdk.os,
        resolution: this.sdk.resolution,
      });

      const duration = Date.now() - startTime;

      console.log("AI Response Text:", response?.response.content[0]?.text);

      if (response && response.coordinates) {
        // Store response but clear large base64 data to prevent memory leaks
        this._response = this._sanitizeResponse(response);
        this.coordinates = response.coordinates;
        this._found = true;

        // Log debug information when element is found
        this._logFoundDebug(response, duration);
      } else {
        this._response = this._sanitizeResponse(response);
        this._found = false;
        findError = "Element not found";
      }
    } catch (error) {
      this._response = error.response
        ? this._sanitizeResponse(error.response)
        : null;
      this._found = false;
      findError = error.message;
      response = error.response;
    }

    // Track find interaction once at the end
    const sessionId = this.sdk.getSessionId();
    if (sessionId && this.sdk.sandbox?.send) {
      try {
        await this.sdk.sandbox.send({
          type: "trackInteraction",
          interactionType: "find",
          session: sessionId,
          prompt: description,
          timestamp: startTime,
          success: this._found,
          error: findError,
          cacheHit: response?.cacheHit || response?.cache_hit || response?.cached || false,
          selector: response?.selector,
          selectorUsed: !!response?.selector,
        });
      } catch (err) {
        console.warn("Failed to track find interaction:", err.message);
      }
    }

    return this;
  }

  /**
   * Sanitize response by removing large base64 data to prevent memory leaks
   * @private
   * @param {Object} response - API response
   * @returns {Object} Sanitized response
   */
  _sanitizeResponse(response) {
    if (!response) return null;

    // Only keep base64 data in DEBUG mode
    const debugMode =
      process.env.VERBOSE || process.env.DEBUG || process.env.TD_DEBUG;
    if (debugMode) {
      return response;
    }

    // Create shallow copy and remove large base64 fields
    const sanitized = { ...response };
    delete sanitized.croppedImage;
    delete sanitized.screenshot;

    return sanitized;
  }

  /**
   * Log debug information when element is successfully found
   * @private
   */
  async _logFoundDebug(response, duration) {
    const debugInfo = {
      description: this.description,
      coordinates: this.coordinates,
      duration: `${duration}ms`,
      cacheHit:
        response.cacheHit || response.cache_hit || response.cached || false,
      cacheStrategy: response.cacheStrategy || null,
      similarity: response.similarity ?? null,
      confidence: response.confidence ?? null,
    };

    // Emit element found as log:log event
    const { events } = require("./agent/events.js");
    const formattedMessage = formatter.formatElementFound(this.description, {
      x: this.coordinates.x,
      y: this.coordinates.y,
      duration: debugInfo.duration,
      cacheHit: debugInfo.cacheHit,
    });
    this.sdk.emitter.emit(events.log.log, formattedMessage);

    // Log cache information in debug mode
    const debugMode =
      process.env.VERBOSE || process.env.DEBUG || process.env.TD_DEBUG;
    if (debugMode) {
      const { events } = require("./agent/events.js");
      this.sdk.emitter.emit(events.log.debug, "Element Found:");
      this.sdk.emitter.emit(
        events.log.debug,
        `  Description: ${debugInfo.description}`,
      );
      this.sdk.emitter.emit(
        events.log.debug,
        `  Coordinates: (${this.coordinates.x}, ${this.coordinates.y})`,
      );
      this.sdk.emitter.emit(
        events.log.debug,
        `  Duration: ${debugInfo.duration}`,
      );
      this.sdk.emitter.emit(
        events.log.debug,
        `  Cache Hit: ${debugInfo.cacheHit ? "✅ YES" : "❌ NO"}`,
      );
      if (debugInfo.cacheHit) {
        this.sdk.emitter.emit(
          events.log.debug,
          `  Cache Strategy: ${debugInfo.cacheStrategy || "unknown"}`,
        );
        this.sdk.emitter.emit(
          events.log.debug,
          `  Similarity: ${debugInfo.similarity !== null ? (debugInfo.similarity * 100).toFixed(2) + "%" : "N/A"}`,
        );
        if (response.cacheCreatedAt) {
          const cacheAge = Math.round(
            (Date.now() - new Date(response.cacheCreatedAt).getTime()) / 1000,
          );
          this.sdk.emitter.emit(
            events.log.debug,
            `  Cache Age: ${cacheAge}s (created: ${new Date(response.cacheCreatedAt).toISOString()})`,
          );
        }
        if (response.cachedImageUrl) {
          this.sdk.emitter.emit(
            events.log.debug,
            `  Cached Image URL: ${response.cachedImageUrl}`,
          );
        }
        if (response.cacheDiffPercent !== undefined) {
          this.sdk.emitter.emit(
            events.log.debug,
            `  Pixel Diff: ${(response.cacheDiffPercent * 100).toFixed(2)}%`,
          );
        }
      }
      if (debugInfo.confidence !== null) {
        this.sdk.emitter.emit(
          events.log.debug,
          `  Confidence: ${(debugInfo.confidence * 100).toFixed(2)}%`,
        );
      }

      // Log available response fields for debugging
      this.sdk.emitter.emit(
        events.log.debug,
        `  Has croppedImage: ${!!response.croppedImage}`,
      );
      this.sdk.emitter.emit(
        events.log.debug,
        `  Has screenshot: ${!!response.screenshot}`,
      );
      this.sdk.emitter.emit(
        events.log.debug,
        `  Has cachedImageUrl: ${!!response.cachedImageUrl}`,
      );
      this.sdk.emitter.emit(
        events.log.debug,
        `  Has pixelDiffImage: ${!!response.pixelDiffImage}`,
      );
    }

    // Save cropped image with red circle if available
    let croppedImagePath = null;
    if (response.croppedImage) {
      try {
        const tempDir = path.join(os.tmpdir(), "testdriver-debug");
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const filename = `element-found-${Date.now()}.png`;
        croppedImagePath = path.join(tempDir, filename);

        // Remove data:image/png;base64, prefix if present
        const base64Data = response.croppedImage.replace(
          /^data:image\/\w+;base64,/,
          "",
        );
        const buffer = Buffer.from(base64Data, "base64");

        fs.writeFileSync(croppedImagePath, buffer);

        if (debugMode) {
          const { events } = require("./agent/events.js");
          this.sdk.emitter.emit(
            events.log.debug,
            `  Debug Image: ${croppedImagePath}`,
          );
        }
      } catch (err) {
        const { events } = require("./agent/events.js");
        const errorMsg = formatter.formatError(
          "Failed to save debug image",
          err,
        );
        this.sdk.emitter.emit(events.log.log, errorMsg);
      }
    }

    // Save cached screenshot if available and this was a cache hit
    let cachedScreenshotPath = null;
    if (debugInfo.cacheHit && response.screenshot) {
      try {
        const tempDir = path.join(os.tmpdir(), "testdriver-debug");
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const filename = `cached-screenshot-${Date.now()}.png`;
        cachedScreenshotPath = path.join(tempDir, filename);

        // Remove data:image/png;base64, prefix if present
        const base64Data = response.screenshot.replace(
          /^data:image\/\w+;base64,/,
          "",
        );
        const buffer = Buffer.from(base64Data, "base64");

        fs.writeFileSync(cachedScreenshotPath, buffer);

        if (debugMode) {
          const { events } = require("./agent/events.js");
          this.sdk.emitter.emit(
            events.log.debug,
            `  Cached Screenshot: ${cachedScreenshotPath}`,
          );
        }
      } catch (err) {
        const { events } = require("./agent/events.js");
        const errorMsg = formatter.formatError(
          "Failed to save cached screenshot",
          err,
        );
        this.sdk.emitter.emit(events.log.log, errorMsg);
      }
    }

    // Save pixel diff image if available and this was a cache hit
    let pixelDiffPath = null;
    if (debugInfo.cacheHit && response.pixelDiffImage) {
      try {
        const tempDir = path.join(os.tmpdir(), "testdriver-debug");
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const filename = `pixel-diff-${Date.now()}.png`;
        pixelDiffPath = path.join(tempDir, filename);

        // Remove data:image/png;base64, prefix if present
        const base64Data = response.pixelDiffImage.replace(
          /^data:image\/\w+;base64,/,
          "",
        );
        const buffer = Buffer.from(base64Data, "base64");

        fs.writeFileSync(pixelDiffPath, buffer);

        if (debugMode) {
          const { events } = require("./agent/events.js");
          this.sdk.emitter.emit(
            events.log.debug,
            `  Pixel Diff Image: ${pixelDiffPath}`,
          );
        }
      } catch (err) {
        const { events } = require("./agent/events.js");
        const errorMsg = formatter.formatError(
          "Failed to save pixel diff image",
          err,
        );
        this.sdk.emitter.emit(events.log.log, errorMsg);
      }
    }
  }

  /**
   * Click on the element
   * @param {ClickAction} [action='click'] - Type of click action
   * @returns {Promise<void>}
   */
  async click(action = "click") {
    if (!this._found || !this.coordinates) {
      throw new ElementNotFoundError(
        `Element "${this.description}" not found.`,
        {
          description: this.description,
          aiResponse: this._response,
          threshold: this._threshold,
        },
      );
    }

    // Log the action
    const { events } = require("./agent/events.js");
    const actionName = action === "click" ? "click" : action.replace("-", " ");
    const formattedMessage = formatter.formatAction(
      actionName,
      this.description,
    );
    this.sdk.emitter.emit(events.log.log, formattedMessage);

    // Prepare element metadata for interaction tracking
    const elementData = {
      prompt: this.description,
      elementType: this._response?.elementType,
      elementBounds: this._response?.elementBounds,
      croppedImageUrl: this._response?.savedImagePath,
      edgeDetectedImageUrl: this._response?.edgeSavedImagePath || null,
      cacheHit: this._response?.cacheHit,
      selectorUsed: !!this._response?.selector,
      selector: this._response?.selector
    };

    if (action === "hover") {
      await this.commands.hover(this.coordinates.x, this.coordinates.y, elementData);
    } else {
      await this.commands.click(this.coordinates.x, this.coordinates.y, action, elementData);
    }
  }

  /**
   * Hover over the element
   * @returns {Promise<void>}
   */
  async hover() {
    if (!this._found || !this.coordinates) {
      throw new ElementNotFoundError(
        `Element "${this.description}" not found.`,
        {
          description: this.description,
          aiResponse: this._response,
          threshold: this._threshold,
        },
      );
    }

    // Log the hover action
    const { events } = require("./agent/events.js");
    const formattedMessage = formatter.formatAction("hover", this.description);
    this.sdk.emitter.emit(events.log.log, formattedMessage);

    // Prepare element metadata for interaction tracking
    const elementData = {
      prompt: this.description,
      elementType: this._response?.elementType,
      elementBounds: this._response?.elementBounds,
      croppedImageUrl: this._response?.savedImagePath,
      edgeDetectedImageUrl: this._response?.edgeSavedImagePath || null,
      cacheHit: this._response?.cacheHit,
      selectorUsed: !!this._response?.selector,
      selector: this._response?.selector
    };

    await this.commands.hover(this.coordinates.x, this.coordinates.y, elementData);
  }

  /**
   * Double-click on the element
   * @returns {Promise<void>}
   */
  async doubleClick() {
    return this.click("double-click");
  }

  /**
   * Right-click on the element
   * @returns {Promise<void>}
   */
  async rightClick() {
    return this.click("right-click");
  }

  /**
   * Press mouse button down on this element
   * @returns {Promise<void>}
   */
  async mouseDown() {
    return this.click("mouseDown");
  }

  /**
   * Release mouse button on this element
   * @returns {Promise<void>}
   */
  async mouseUp() {
    return this.click("mouseUp");
  }

  /**
   * Get the coordinates of the element
   * @returns {{x: number, y: number, centerX: number, centerY: number}|null}
   */
  getCoordinates() {
    return this.coordinates;
  }

  /**
   * Get the x coordinate (top-left)
   * @returns {number|null}
   */
  get x() {
    return this.coordinates?.x ?? null;
  }

  /**
   * Get the y coordinate (top-left)
   * @returns {number|null}
   */
  get y() {
    return this.coordinates?.y ?? null;
  }

  /**
   * Get the center x coordinate
   * @returns {number|null}
   */
  get centerX() {
    return this.coordinates?.centerX ?? null;
  }

  /**
   * Get the center y coordinate
   * @returns {number|null}
   */
  get centerY() {
    return this.coordinates?.centerY ?? null;
  }

  /**
   * Get the full API response data
   * @returns {Object|null}
   */
  getResponse() {
    return this._response;
  }

  /**
   * Get element screenshot if available
   * @returns {string|null} Base64 encoded screenshot
   */
  get screenshot() {
    return this._response?.screenshot ?? null;
  }

  /**
   * Get element confidence score if available
   * @returns {number|null}
   */
  get confidence() {
    return this._response?.confidence ?? null;
  }

  /**
   * Get element width if available
   * @returns {number|null}
   */
  get width() {
    return this._response?.width ?? null;
  }

  /**
   * Get element height if available
   * @returns {number|null}
   */
  get height() {
    return this._response?.height ?? null;
  }

  /**
   * Get element bounding box if available
   * @returns {Object|null}
   */
  get boundingBox() {
    return this._response?.boundingBox ?? null;
  }

  /**
   * Get element text content if available
   * @returns {string|null}
   */
  get text() {
    return this._response?.text ?? null;
  }

  /**
   * Get element label if available
   * @returns {string|null}
   */
  get label() {
    return this._response?.label ?? null;
  }

  /**
   * Save the debug screenshot to a file for manual inspection
   * @param {string} [filepath] - Path to save the screenshot (defaults to ./debug-screenshot-{timestamp}.png)
   * @returns {Promise<string>} Path to the saved screenshot
   */
  async saveDebugScreenshot(filepath) {
    if (!this._screenshot) {
      throw new Error("No screenshot available.");
    }

    const fs = require("fs").promises;
    const path = require("path");

    const defaultPath = `./debug-screenshot-${Date.now()}.png`;
    const savePath = filepath || defaultPath;

    // Remove data:image/png;base64, prefix if present
    const base64Data = this._screenshot.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    await fs.writeFile(savePath, buffer);
    return path.resolve(savePath);
  }

  /**
   * Get debug information about the last find operation
   * @returns {Object} Debug information including AI response and screenshot metadata
   */
  getDebugInfo() {
    return {
      description: this.description,
      found: this._found,
      coordinates: this.coordinates,
      aiResponse: this._response,
      hasScreenshot: !!this._screenshot,
      screenshotSize: this._screenshot ? this._screenshot.length : 0,
    };
  }

  /**
   * Clean up element resources to prevent memory leaks
   * Call this when you're done with the element
   */
  destroy() {
    this._screenshot = null;
    this._response = null;
    this.coordinates = null;
    this.sdk = null;
    this.system = null;
    this.commands = null;
  }
}

/**
 * Creates a chainable promise that allows method chaining on find() results
 * This enables syntax like: await testdriver.find("button").click()
 * 
 * @param {Promise<Element>} promise - The promise that resolves to an Element
 * @returns {Promise<Element> & ChainableElement} A promise with chainable element methods
 */
function createChainablePromise(promise) {
  // Define the chainable methods that should be available
  const chainableMethods = ['click', 'hover', 'doubleClick', 'rightClick', 'mouseDown', 'mouseUp'];
  
  // Create a new promise that wraps the original
  const chainablePromise = promise.then(element => element);
  
  // Add chainable methods to the promise
  for (const method of chainableMethods) {
    chainablePromise[method] = function(...args) {
      // Return a promise that waits for the element, then calls the method
      return promise.then(element => element[method](...args));
    };
  }
  
  // Add getters for element properties (these return promises)
  Object.defineProperty(chainablePromise, 'x', {
    get() { return promise.then(el => el.x); }
  });
  Object.defineProperty(chainablePromise, 'y', {
    get() { return promise.then(el => el.y); }
  });
  Object.defineProperty(chainablePromise, 'centerX', {
    get() { return promise.then(el => el.centerX); }
  });
  Object.defineProperty(chainablePromise, 'centerY', {
    get() { return promise.then(el => el.centerY); }
  });
  
  // Add found() method
  chainablePromise.found = function() {
    return promise.then(el => el.found());
  };
  
  // Add getCoordinates() method
  chainablePromise.getCoordinates = function() {
    return promise.then(el => el.getCoordinates());
  };
  
  // Add getResponse() method
  chainablePromise.getResponse = function() {
    return promise.then(el => el.getResponse());
  };
  
  return chainablePromise;
}

/**
 * TestDriver SDK
 *
 * This SDK provides programmatic access to TestDriver's AI-powered testing capabilities.
 *
 * @example
 * const TestDriver = require('testdriverai');
 *
 * const client = new TestDriver(process.env.TD_API_KEY);
 * await client.connect();
 *
 * // New API
 * const element = await client.find('Submit button');
 * await element.click();
 *
 * // Legacy API (deprecated)
 * await client.hoverText('Submit');
 * await client.click();
 */

/**
 * @typedef {'click' | 'right-click' | 'double-click' | 'hover' | 'mouseDown' | 'mouseUp'} ClickAction
 * @typedef {'up' | 'down' | 'left' | 'right'} ScrollDirection
 * @typedef {'keyboard' | 'mouse'} ScrollMethod
 * @typedef {'ai' | 'turbo'} TextMatchMethod
 * @typedef {'js' | 'pwsh'} ExecLanguage
 * @typedef {'\\t' | '\n' | '\r' | ' ' | '!' | '"' | '#' | '$' | '%' | '&' | "'" | '(' | ')' | '*' | '+' | ',' | '-' | '.' | '/' | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ':' | ';' | '<' | '=' | '>' | '?' | '@' | '[' | '\\' | ']' | '^' | '_' | '`' | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm' | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z' | '{' | '|' | '}' | '~' | 'accept' | 'add' | 'alt' | 'altleft' | 'altright' | 'apps' | 'backspace' | 'browserback' | 'browserfavorites' | 'browserforward' | 'browserhome' | 'browserrefresh' | 'browsersearch' | 'browserstop' | 'capslock' | 'clear' | 'convert' | 'ctrl' | 'ctrlleft' | 'ctrlright' | 'decimal' | 'del' | 'delete' | 'divide' | 'down' | 'end' | 'enter' | 'esc' | 'escape' | 'execute' | 'f1' | 'f10' | 'f11' | 'f12' | 'f13' | 'f14' | 'f15' | 'f16' | 'f17' | 'f18' | 'f19' | 'f2' | 'f20' | 'f21' | 'f22' | 'f23' | 'f24' | 'f3' | 'f4' | 'f5' | 'f6' | 'f7' | 'f8' | 'f9' | 'final' | 'fn' | 'hanguel' | 'hangul' | 'hanja' | 'help' | 'home' | 'insert' | 'junja' | 'kana' | 'kanji' | 'launchapp1' | 'launchapp2' | 'launchmail' | 'launchmediaselect' | 'left' | 'modechange' | 'multiply' | 'nexttrack' | 'nonconvert' | 'num0' | 'num1' | 'num2' | 'num3' | 'num4' | 'num5' | 'num6' | 'num7' | 'num8' | 'num9' | 'numlock' | 'pagedown' | 'pageup' | 'pause' | 'pgdn' | 'pgup' | 'playpause' | 'prevtrack' | 'print' | 'printscreen' | 'prntscrn' | 'prtsc' | 'prtscr' | 'return' | 'right' | 'scrolllock' | 'select' | 'separator' | 'shift' | 'shiftleft' | 'shiftright' | 'sleep' | 'space' | 'stop' | 'subtract' | 'tab' | 'up' | 'volumedown' | 'volumemute' | 'volumeup' | 'win' | 'winleft' | 'winright' | 'yen' | 'command' | 'option' | 'optionleft' | 'optionright'} KeyboardKey
 */

const TestDriverAgent = require("./agent/index.js");
const { events } = require("./agent/events.js");
const { createMarkdownLogger } = require("./interfaces/logger.js");

class TestDriverSDK {
  constructor(apiKey, options = {}) {
    // Set up environment with API key
    const environment = {
      TD_API_KEY: apiKey,
      TD_API_ROOT: options.apiRoot || "https://testdriver-api.onrender.com",
      TD_RESOLUTION: options.resolution || "1366x768",
      TD_ANALYTICS: options.analytics !== false,
      ...options.environment,
    };

    // Create the underlying agent with minimal CLI args
    this.agent = new TestDriverAgent(environment, {
      command: "sdk",
      args: [],
      options: {
        os: options.os || "linux",
      },
    });

    // Auto-generate cache key from caller file hash if not explicitly provided
    // This allows caching to be tied to the specific test file
    if (!options.cacheKey) {
      const autoGeneratedKey = getCallerFileHash();
      if (autoGeneratedKey) {
        options.cacheKey = autoGeneratedKey;
        // Store flag to indicate this was auto-generated
        this._autoGeneratedCacheKey = true;
      }
    }

    // Store options for later use
    this.options = options;

    // Store os and resolution for API requests
    this.os = options.os || "linux";
    this.resolution = options.resolution || "1366x768";

    // Store newSandbox preference from options
    this.newSandbox =
      options.newSandbox !== undefined ? options.newSandbox : true;

    // Store headless preference from options
    this.headless = options.headless !== undefined ? options.headless : false;

    // Store IP address if provided for direct connection
    this.ip = options.ip || null;

    // Store sandbox configuration options
    this.sandboxAmi = options.sandboxAmi || null;
    this.sandboxOs = options.sandboxOs || null;
    this.sandboxInstance = options.sandboxInstance || null;

    // Cache threshold configuration
    // threshold = pixel difference allowed (0.05 = 5% difference, 95% similarity)
    // By default, cache is DISABLED (threshold = -1) to avoid unnecessary AI costs
    // To enable cache, provide a cacheKey when calling find() or findAll()
    // Also support TD_NO_CACHE environment variable and cache: false option for backwards compatibility
    const cacheDisabled =
      options.cache === false || process.env.TD_NO_CACHE === "true";

    if (cacheDisabled) {
      // Explicit cache disabled via option or env var
      this.cacheThresholds = {
        find: -1,
        findAll: -1,
      };
    } else {
      // Cache disabled by default, enabled only when cacheKey is provided
      // Note: The threshold value here is the fallback when cacheKey is NOT provided
      this.cacheThresholds = {
        find: options.cacheThreshold?.find ?? -1,  // Default: cache disabled
        findAll: options.cacheThreshold?.findAll ?? -1,  // Default: cache disabled
      };
    }

    // Redraw configuration
    // Supports both:
    //   - redraw: { enabled: true, diffThreshold: 0.1, screenRedraw: true, networkMonitor: true }
    //   - redrawThreshold: 0.1 (legacy, sets diffThreshold)
    // The `redraw` option takes precedence and matches the per-command API
    if (options.redraw !== undefined) {
      // New unified API: redraw object (matches per-command options)
      this.redrawOptions = typeof options.redraw === 'object' 
        ? options.redraw 
        : { enabled: options.redraw }; // Support redraw: false as shorthand
    } else if (options.redrawThreshold !== undefined) {
      // Legacy API: redrawThreshold number or object
      this.redrawOptions = typeof options.redrawThreshold === 'object'
        ? options.redrawThreshold
        : { diffThreshold: options.redrawThreshold };
    } else {
      // Default: enabled (as of v7.2)
      this.redrawOptions = { enabled: true };
    }
    // Keep redrawThreshold for backwards compatibility in connect()
    this.redrawThreshold = this.redrawOptions;

    // Track connection state
    this.connected = false;
    this.authenticated = false;

    // Expose commonly used agent properties
    this.emitter = this.agent.emitter;
    this.config = this.agent.config;
    this.session = this.agent.session;
    this.apiClient = this.agent.sdk;
    this.analytics = this.agent.analytics;
    this.sandbox = this.agent.sandbox;
    this.system = this.agent.system;
    this.instance = null;

    // Commands will be set up dynamically after connection
    this.commands = null;

    // Set up logging if enabled (after emitter is exposed)
    this.loggingEnabled = options.logging !== false;

    // Set up event listeners once (they live for the lifetime of the SDK instance)
    this._setupLogging();

    // Set up provision API
    this.provision = this._createProvisionAPI();

    // Set up dashcam API lazily
    this._dashcam = null;
  }

  /**
   * Wait for the sandbox connection to complete
   * @returns {Promise<void>}
   */
  async ready() {
    if (this.__connectionPromise) {
      await this.__connectionPromise;
    }
    if (!this.connected) {
      throw new Error('Not connected to sandbox. Call connect() first or use autoConnect option.');
    }
  }

  /**
   * Get or create the Dashcam instance
   * @returns {Dashcam} Dashcam instance
   */
  get dashcam() {
    if (!this._dashcam) {
      const { Dashcam } = require("./lib/core/index.js");
      // Don't pass apiKey - let Dashcam use its default key
      this._dashcam = new Dashcam(this);
    }
    return this._dashcam;
  }

  /**
   * Get milliseconds elapsed since dashcam started recording
   * @returns {number|null} Milliseconds since dashcam start, or null if not recording
   */
  getDashcamElapsedTime() {
    if (this._dashcam) {
      return this._dashcam.getElapsedTime();
    }
    return null;
  }

  /**
   * Create the provision API with methods for launching applications
   * @private
   */
  _createProvisionAPI() {
    return {
      /**
       * Launch Chrome browser
       * @param {Object} options - Chrome launch options
       * @param {string} [options.url='http://testdriver-sandbox.vercel.app/'] - URL to navigate to
       * @param {boolean} [options.maximized=true] - Start maximized
       * @param {boolean} [options.guest=false] - Use guest mode
       * @returns {Promise<void>}
       */
      chrome: async (options = {}) => {
        // Automatically wait for connection to be ready
        await this.ready();
        
        const {
          url = 'http://testdriver-sandbox.vercel.app/',
          maximized = true,
          guest = false,
        } = options;

        // If dashcam is available and recording, add web logs for this domain
        if (this._dashcam) {
    
            // Create the log file on the remote machine
            const shell = this.os === "windows" ? "pwsh" : "sh";
            const logPath = this.os === "windows" 
            ? "C:\\Users\\testdriver\\Documents\\testdriver.log"
            : "/tmp/testdriver.log";
            
            const createLogCmd = this.os === "windows"
            ? `New-Item -ItemType File -Path "${logPath}" -Force | Out-Null`
            : `touch ${logPath}`;
            
            await this.exec(shell, createLogCmd, 10000, true);
          
          console.log('[provision.chrome] Adding web logs to dashcam...');
          try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname;
            const pattern = `*${domain}*`;
            await this._dashcam.addWebLog(pattern, 'Web Logs');
            console.log(`[provision.chrome] ✅ Web logs added to dashcam (pattern: ${pattern})`);

            await this._dashcam.addFileLog(logPath, "TestDriver Log");

          } catch (error) {
            console.warn('[provision.chrome] ⚠️  Failed to add web logs:', error.message);
          }
        }
        
        // Automatically start dashcam if not already recording
        if (!this._dashcam || !this._dashcam.recording) {
          console.log('[provision.chrome] Starting dashcam...');
          await this.dashcam.start();
          console.log('[provision.chrome] ✅ Dashcam started');
        }

        // Build Chrome launch command
        const chromeArgs = [];
        if (maximized) chromeArgs.push('--start-maximized');
        if (guest) chromeArgs.push('--guest');
        chromeArgs.push('--disable-fre', '--no-default-browser-check', '--no-first-run');
        
        // Add dashcam-chrome extension on Linux
        if (this.os === 'linux') {
          chromeArgs.push('--load-extension=/usr/lib/node_modules/dashcam-chrome/build');
        }

        // Launch Chrome
        const shell = this.os === 'windows' ? 'pwsh' : 'sh';
        
        if (this.os === 'windows') {
          const argsString = chromeArgs.map(arg => `"${arg}"`).join(', ');
          await this.exec(
            shell,
            `Start-Process "C:/Program Files/Google/Chrome/Application/chrome.exe" -ArgumentList ${argsString}, "${url}"`,
            30000
          );
        } else {
          const argsString = chromeArgs.join(' ');
          await this.exec(
            shell,
            `chrome-for-testing ${argsString} "${url}" >/dev/null 2>&1 &`,
            30000
          );
        }

        // Wait for Chrome to be ready
        await this.focusApplication('Google Chrome');


        // Wait for URL to load
        try {
          const urlObj = new URL(url);
          const domain = urlObj.hostname;
          
          console.log(`[provision.chrome] Waiting for domain "${domain}" to appear in URL bar...`);
          
          for (let attempt = 0; attempt < 30; attempt++) {
            try {
              const result = await this.find(`${domain}`);
              if (result.found()) {
                console.log(`[provision.chrome] ✅ Chrome ready at ${url}`);
                break;
              }
            } catch (e) {
              // Not found yet, continue polling
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          await this.focusApplication('Google Chrome');
        } catch (e) {
          console.warn(`[provision.chrome] ⚠️  Could not parse URL "${url}":`, e.message);
        }
      },

      /**
       * Launch VS Code
       * @param {Object} options - VS Code launch options
       * @param {string} [options.workspace] - Workspace/folder to open
       * @param {string[]} [options.extensions=[]] - Extensions to install
       * @returns {Promise<void>}
       */
      vscode: async (options = {}) => {
        this._ensureConnected();
        
        const {
          workspace = null,
          extensions = [],
        } = options;

        // Install extensions if provided
        for (const extension of extensions) {
          const shell = this.os === 'windows' ? 'pwsh' : 'sh';
          await this.exec(
            shell,
            `code --install-extension ${extension}`,
            60000,
            true
          );
        }

        // Launch VS Code
        const shell = this.os === 'windows' ? 'pwsh' : 'sh';
        const workspaceArg = workspace ? `"${workspace}"` : '';
        
        if (this.os === 'windows') {
          await this.exec(
            shell,
            `Start-Process code -ArgumentList ${workspaceArg}`,
            30000
          );
        } else {
          await this.exec(
            shell,
            `code ${workspaceArg} >/dev/null 2>&1 &`,
            30000
          );
        }

        // Wait for VS Code to be ready
        await this.focusApplication('Visual Studio Code');
        console.log('[provision.vscode] ✅ VS Code ready');
      },

      /**
       * Launch Electron app
       * @param {Object} options - Electron launch options
       * @param {string} options.appPath - Path to Electron app (required)
       * @param {string[]} [options.args=[]] - Additional electron args
       * @returns {Promise<void>}
       */
      electron: async (options = {}) => {
        this._ensureConnected();
        
        const { appPath, args = [] } = options;
        
        if (!appPath) {
          throw new Error('provision.electron requires appPath option');
        }

        const shell = this.os === 'windows' ? 'pwsh' : 'sh';
        const argsString = args.join(' ');
        
        if (this.os === 'windows') {
          await this.exec(
            shell,
            `Start-Process electron -ArgumentList "${appPath}", ${argsString}`,
            30000
          );
        } else {
          await this.exec(
            shell,
            `electron "${appPath}" ${argsString} >/dev/null 2>&1 &`,
            30000
          );
        }

        await this.focusApplication('Electron');
        console.log('[provision.electron] ✅ Electron app ready');
      },
    };
  }

  /**
   * Authenticate with TestDriver API
   * @returns {Promise<string>} Authentication token
   */
  async auth() {
    if (this.authenticated) {
      return;
    }

    const token = await this.apiClient.auth();
    this.authenticated = true;
    return token;
  }

  /**
   * Connect to a sandbox environment
   * @param {Object} options - Connection options
   * @param {string} options.sandboxId - Existing sandbox ID to reconnect to
   * @param {boolean} options.newSandbox - Force creation of a new sandbox
   * @param {string} options.ip - Direct IP address to connect to
   * @param {string} options.sandboxAmi - AMI to use for the sandbox
   * @param {string} options.sandboxInstance - Instance type for the sandbox
   * @param {string} options.os - Operating system for the sandbox (windows or linux)
   * @param {boolean} options.reuseConnection - Reuse recent connection if available (default: true)
   * @returns {Promise<Object>} Sandbox instance details
   */
  async connect(connectOptions = {}) {
    if (this.connected) {
      throw new Error(
        "Already connected. Create a new TestDriver instance to connect again.",
      );
    }

    // Authenticate first if not already authenticated
    if (!this.authenticated) {
      await this.auth();
    }

    // Initialize debugger server before connecting to sandbox
    // This ensures the debuggerUrl is available for renderSandbox
    await this._initializeDebugger();

    // Map SDK connect options to agent buildEnv options
    // Use connectOptions.newSandbox if provided, otherwise fall back to this.newSandbox
    // Use connectOptions.headless if provided, otherwise fall back to this.headless
    const buildEnvOptions = {
      headless:
        connectOptions.headless !== undefined
          ? connectOptions.headless
          : this.headless,
      new:
        connectOptions.newSandbox !== undefined
          ? connectOptions.newSandbox
          : this.newSandbox,
    };

    // Set agent properties for buildEnv to use
    if (connectOptions.sandboxId) {
      this.agent.sandboxId = connectOptions.sandboxId;
    }
    // Use IP from connectOptions if provided, otherwise fall back to constructor IP
    if (connectOptions.ip !== undefined) {
      this.agent.ip = connectOptions.ip;
    } else if (this.ip) {
      this.agent.ip = this.ip;
    }
    // Use sandboxAmi from connectOptions if provided, otherwise fall back to constructor value
    if (connectOptions.sandboxAmi !== undefined) {
      this.agent.sandboxAmi = connectOptions.sandboxAmi;
    } else if (this.sandboxAmi) {
      this.agent.sandboxAmi = this.sandboxAmi;
    }
    // Use sandboxInstance from connectOptions if provided, otherwise fall back to constructor value
    if (connectOptions.sandboxInstance !== undefined) {
      this.agent.sandboxInstance = connectOptions.sandboxInstance;
    } else if (this.sandboxInstance) {
      this.agent.sandboxInstance = this.sandboxInstance;
    }
    // Use os from connectOptions if provided, otherwise fall back to constructor value
    if (connectOptions.os !== undefined) {
      this.agent.sandboxOs = connectOptions.os;
    } else if (this.sandboxOs) {
      this.agent.sandboxOs = this.sandboxOs;
    } else {
      // Fall back to this.os (which defaults to "linux")
      this.agent.sandboxOs = this.os;
    }

    // Set redrawThreshold on agent's cliArgs.options
    this.agent.cliArgs.options.redrawThreshold = this.redrawThreshold;

    // Use the agent's buildEnv method which handles all the connection logic
    await this.agent.buildEnv(buildEnvOptions);

    // Get the instance from the agent
    this.instance = this.agent.instance;

    // Expose the agent's commands, parser, and commander
    this.commands = this.agent.commands;

    // Recreate commands with dashcam elapsed time support
    const { createCommands } = require("./agent/lib/commands.js");
    const commandsResult = createCommands(
      this.agent.emitter,
      this.agent.system,
      this.agent.sandbox,
      this.agent.config,
      this.agent.session,
      () => this.agent.sourceMapper?.currentFilePath || this.agent.thisFile,
      this.agent.cliArgs.options.redrawThreshold,
      () => this.getDashcamElapsedTime(), // Pass dashcam elapsed time function
    );
    this.commands = commandsResult.commands;
    this.agent.commands = commandsResult.commands;
    this.agent.redraw = commandsResult.redraw;

    // Dynamically create command methods based on available commands
    this._setupCommandMethods();

    this.connected = true;
    this.analytics.track("sdk.connect", {
      sandboxId: this.instance?.instanceId,
    });

    return this.instance;
  }

  /**
   * Disconnect from the sandbox
   * Note: After disconnecting, you cannot reconnect with the same SDK instance.
   * Create a new TestDriver instance if you need to connect again.
   * @returns {Promise<void>}
   */
  async disconnect() {
    // Track disconnect event if we were connected
    if (this.connected && this.instance) {
      this.analytics.track("sdk.disconnect");
    }

    // Always close the sandbox WebSocket connection to clean up resources
    // This ensures we don't leave orphaned connections even if connect() failed
    if (this.sandbox && typeof this.sandbox.close === 'function') {
      this.sandbox.close();
    }

    this.connected = false;
    this.instance = null;
  }

  /**
   * Get the current session ID
   * Used for tracking and associating dashcam recordings with test results
   * @returns {string|null} The session ID or null if not connected
   */
  getSessionId() {
    return this.session?.get() || null;
  }

  // ====================================
  // Element Finding API
  // ====================================

  /**
   * Find an element by description
   * Automatically locates the element and returns it
   *
   * @param {string} description - Description of the element to find
   * @param {number | Object} [options] - Cache options: number for threshold, or object with {cacheKey, cacheThreshold}
   * @returns {Promise<Element> & ChainableElement} Element instance that has been located, with chainable methods
   *
   * @example
   * // Find and click immediately (chainable)
   * await client.find('the sign in button').click();
   *
   * @example
   * // Find and click (traditional)
   * const element = await client.find('the sign in button');
   * await element.click();
   *
   * @example
   * // Find with cache key to enable caching
   * const element = await client.find('login button', { cacheKey: 'my-test-run' });
   *
   * @example
   * // Find with custom cache threshold (legacy)
   * const element = await client.find('login button', 0.01);
   *
   * @example
   * // Poll until element is found
   * let element;
   * while (!element?.found()) {
   *   element = await client.find('login button');
   *   if (!element.found()) {
   *     await new Promise(resolve => setTimeout(resolve, 1000));
   *   }
   * }
   * await element.click();
   */
  find(description, options) {
    this._ensureConnected();
    const element = new Element(description, this, this.system, this.commands);
    const findPromise = element.find(null, options);
    
    // Create a chainable promise that allows direct method chaining
    // e.g., await testdriver.find("button").click()
    return createChainablePromise(findPromise);
  }

  /**
   * Find all elements matching a description
   * Automatically locates all matching elements and returns them as an array
   *
   * @param {string} description - Description of the elements to find
   * @param {number | Object} [options] - Cache options: number for threshold, or object with {cacheKey, cacheThreshold}
   * @returns {Promise<Element[]>} Array of Element instances that have been located
   *
   * @example
   * // Find all buttons and click the first one
   * const buttons = await client.findAll('button');
   * if (buttons.length > 0) {
   *   await buttons[0].click();
   * }
   *
   * @example
   * // Find all list items with cache key to enable caching
   * const items = await client.findAll('list item', { cacheKey: 'my-test-run' });
   * for (const item of items) {
   *   console.log(`Found item at (${item.x}, ${item.y})`);
   * }
   */
  async findAll(description, options) {
    this._ensureConnected();

    const startTime = Date.now();

    // Log finding all action
    const { events } = require("./agent/events.js");
    const findingMessage = formatter.formatElementsFinding(description);
    this.emitter.emit(events.log.log, findingMessage);

    try {
      const screenshot = await this.system.captureScreenBase64();

      // Handle options - can be a number (cacheThreshold) or object with cacheKey/cacheThreshold
      let cacheKey = null;
      let cacheThreshold = null;
      
      if (typeof options === 'number') {
        // Legacy: options is just a number threshold
        cacheThreshold = options;
      } else if (typeof options === 'object' && options !== null) {
        // New: options is an object with cacheKey and/or cacheThreshold
        cacheKey = options.cacheKey || null;
        cacheThreshold = options.cacheThreshold ?? null;
      }

      // Use default cacheKey from SDK constructor if not provided in findAll() options
      if (!cacheKey && this.options?.cacheKey) {
        cacheKey = this.options.cacheKey;
      }

      // Determine threshold: 
      // - If cacheKey is provided, enable cache (threshold = 0.05 or custom)
      // - If no cacheKey, disable cache (threshold = -1) unless explicitly overridden
      let threshold;
      if (cacheKey) {
        // cacheKey provided - enable cache with threshold
        threshold = cacheThreshold ?? 0.05;
      } else if (cacheThreshold !== null) {
        // Explicit threshold provided without cacheKey
        threshold = cacheThreshold;
      } else {
        // No cacheKey, no explicit threshold - use global default (which is -1 now)
        threshold = this.cacheThresholds?.findAll ?? -1;
      }

      // Debug log threshold
      const debugMode = process.env.VERBOSE || process.env.DEBUG || process.env.TD_DEBUG;
      if (debugMode) {
        const autoGenMsg = (this._autoGeneratedCacheKey && cacheKey === this.options.cacheKey) 
          ? ' (auto-generated from file hash)' 
          : '';
        this.emitter.emit(
          events.log.debug,
          `🔍 findAll() threshold: ${threshold} (cache ${threshold < 0 ? "DISABLED" : "ENABLED"}${cacheKey ? `, cacheKey: ${cacheKey}${autoGenMsg}` : ""})`,
        );
      }

      const response = await this.apiClient.req(
        "/api/v7.0.0/testdriver-agent/testdriver-find-all",
        {
          session: this.getSessionId(),
          element: description,
          image: screenshot,
          threshold: threshold,
          cacheKey: cacheKey,
          os: this.os,
          resolution: this.resolution,
        },
      );

      const duration = Date.now() - startTime;

      if (response && response.elements && response.elements.length > 0) {
        // Log found elements
        const foundMessage = formatter.formatElementsFound(
          description,
          response.elements.length,
          {
            duration: `${duration}ms`,
            cacheHit: response.cached || false,
          },
        );
        this.emitter.emit(events.log.log, foundMessage);

        // Create Element instances for each found element
        const elements = response.elements.map((elementData) => {
          const element = new Element(
            description,
            this,
            this.system,
            this.commands,
          );

          // Set element as found with its coordinates
          element.coordinates = elementData.coordinates;
          element._found = true;
          element._response = this._sanitizeResponseForElement(
            response,
            elementData,
          );

          // Only store screenshot in DEBUG mode
          const debugMode =
            process.env.VERBOSE || process.env.DEBUG || process.env.TD_DEBUG;
          if (debugMode) {
            element._screenshot = screenshot;
          }

          return element;
        });

        // Track successful findAll interaction
        const sessionId = this.getSessionId();
        if (sessionId && this.sandbox?.send) {
          try {
            await this.sandbox.send({
              type: "trackInteraction",
              interactionType: "findAll",
              session: sessionId,
              prompt: description,
              timestamp: startTime,
              success: true,
              input: { count: elements.length },
              cacheHit: response.cached || false,
              selector: response.selector,
              selectorUsed: !!response.selector,
            });
          } catch (err) {
            console.warn("Failed to track findAll interaction:", err.message);
          }
        }

        // Log debug information when elements are found
        if (process.env.VERBOSE || process.env.DEBUG || process.env.TD_DEBUG) {
          const { events } = require("./agent/events.js");
          this.emitter.emit(
            events.log.debug,
            `✓ Found ${elements.length} element(s): "${description}"`,
          );
          this.emitter.emit(
            events.log.debug,
            `  Cache: ${response.cached ? "HIT" : "MISS"}`,
          );
          this.emitter.emit(events.log.debug, `  Time: ${duration}ms`);
        }

        return elements;
      } else {
        // No elements found - track interaction
        const sessionId = this.getSessionId();
        if (sessionId && this.sandbox?.send) {
          try {
            await this.sandbox.send({
              type: "trackInteraction",
              interactionType: "findAll",
              session: sessionId,
              prompt: description,
              timestamp: startTime,
              success: false,
              error: "No elements found",
              input: { count: 0 },
              cacheHit: response?.cached || false,
              selector: response?.selector,
              selectorUsed: !!response?.selector,
            });
          } catch (err) {
            console.warn("Failed to track findAll interaction:", err.message);
          }
        }

        // No elements found - return empty array
        return [];
      }
    } catch (error) {
      // Track findAll error interaction
      const sessionId = this.getSessionId();
      if (sessionId && this.sandbox?.send) {
        try {
          await this.sandbox.send({
            type: "trackInteraction",
            interactionType: "findAll",
            session: sessionId,
            prompt: description,
            timestamp: startTime,
            success: false,
            error: error.message,
            input: { count: 0 },
          });
        } catch (err) {
          console.warn("Failed to track findAll interaction:", err.message);
        }
      }

      const { events } = require("./agent/events.js");
      this.emitter.emit(events.log.log, `Error in findAll: ${error.message}`);
      return [];
    }
  }

  /**
   * Sanitize response for individual element in findAll results
   * @private
   * @param {Object} response - Full API response
   * @param {Object} elementData - Individual element data
   * @returns {Object} Sanitized response for this element
   */
  _sanitizeResponseForElement(response, elementData) {
    const debugMode =
      process.env.VERBOSE || process.env.DEBUG || process.env.TD_DEBUG;

    // Combine global response data with element-specific data
    const sanitized = {
      coordinates: elementData.coordinates,
      cached: response.cached || false,
      elementType: response.elementType,
      extractedText: response.extractedText,
      confidence: elementData.confidence,
      similarity: elementData.similarity,
      boundingBox: elementData.boundingBox,
      width: elementData.width,
      height: elementData.height,
      text: elementData.text,
      label: elementData.label,
    };

    // Only keep large data in debug mode
    if (debugMode) {
      sanitized.croppedImage = elementData.croppedImage;
      sanitized.screenshot = response.screenshot;
    }

    return sanitized;
  }

  // ====================================
  // Command Methods Setup
  // ====================================

  /**
   * Dynamically set up command methods based on available commands
   * This creates camelCase methods that wrap the underlying command functions
   * @private
   */
  _setupCommandMethods() {
    // Mapping from command names to SDK method names with type definitions
    // Each command supports both positional args (legacy) and object args (new)
    const commandMapping = {
      "hover-text": {
        name: "hoverText",
        /**
         * Hover over text on screen
         * @deprecated Use find() and element.click() instead
         * @param {Object|string} options - Options object or text (legacy positional)
         * @param {string} options.text - Text to find and hover over
         * @param {string|null} [options.description] - Optional description of the element
         * @param {ClickAction} [options.action='click'] - Action to perform
         * @param {number} [options.timeout=5000] - Timeout in milliseconds
         * @returns {Promise<{x: number, y: number, centerX: number, centerY: number}>}
         */
        doc: "Hover over text on screen (deprecated - use find() instead)",
      },
      "hover-image": {
        name: "hoverImage",
        /**
         * Hover over an image on screen
         * @deprecated Use find() and element.click() instead
         * @param {Object|string} options - Options object or description (legacy positional)
         * @param {string} options.description - Description of the image to find
         * @param {ClickAction} [options.action='click'] - Action to perform
         * @returns {Promise<{x: number, y: number, centerX: number, centerY: number}>}
         */
        doc: "Hover over an image on screen (deprecated - use find() instead)",
      },
      "match-image": {
        name: "matchImage",
        /**
         * Match and interact with an image template
         * @param {Object|string} options - Options object or path (legacy positional)
         * @param {string} options.path - Path to the image template
         * @param {ClickAction} [options.action='click'] - Action to perform
         * @param {boolean} [options.invert=false] - Invert the match
         * @returns {Promise<boolean>}
         */
        doc: "Match and interact with an image template",
      },
      type: {
        name: "type",
        /**
         * Type text
         * @param {string|number} text - Text to type
         * @param {Object} [options] - Additional options
         * @param {number} [options.delay=250] - Delay between keystrokes in milliseconds
         * @param {boolean} [options.secret=false] - If true, text is treated as sensitive (not logged or stored)
         * @returns {Promise<void>}
         */
        doc: "Type text (use { secret: true } for passwords)",
      },
      "press-keys": {
        name: "pressKeys",
        /**
         * Press keyboard keys
         * @param {KeyboardKey[]} keys - Array of keys to press
         * @param {Object} [options] - Additional options (reserved for future use)
         * @returns {Promise<void>}
         */
        doc: "Press keyboard keys",
      },
      click: {
        name: "click",
        /**
         * Click at coordinates
         * @param {Object|number} options - Options object or x coordinate (legacy positional)
         * @param {number} options.x - X coordinate
         * @param {number} options.y - Y coordinate
         * @param {ClickAction} [options.action='click'] - Type of click action
         * @returns {Promise<void>}
         */
        doc: "Click at coordinates",
      },
      hover: {
        name: "hover",
        /**
         * Hover at coordinates
         * @param {Object|number} options - Options object or x coordinate (legacy positional)
         * @param {number} options.x - X coordinate
         * @param {number} options.y - Y coordinate
         * @returns {Promise<void>}
         */
        doc: "Hover at coordinates",
      },
      scroll: {
        name: "scroll",
        /**
         * Scroll the page
         * @param {ScrollDirection} [direction='down'] - Direction to scroll
         * @param {Object} [options] - Additional options
         * @param {number} [options.amount=300] - Amount to scroll in pixels
         * @returns {Promise<void>}
         */
        doc: "Scroll the page",
      },
      wait: {
        name: "wait",
        /**
         * Wait for specified time
         * @deprecated Consider using element polling with find() instead of arbitrary waits
         * @param {number} [timeout=3000] - Time to wait in milliseconds
         * @param {Object} [options] - Additional options (reserved for future use)
         * @returns {Promise<void>}
         */
        doc: "Wait for specified time (deprecated - consider element polling instead)",
      },
      "wait-for-text": {
        name: "waitForText",
        /**
         * Wait for text to appear on screen
         * @deprecated Use find() in a polling loop instead
         * @param {Object|string} options - Options object or text (legacy positional)
         * @param {string} options.text - Text to wait for
         * @param {number} [options.timeout=5000] - Timeout in milliseconds
         * @returns {Promise<void>}
         */
        doc: "Wait for text to appear on screen (deprecated - use find() in a loop instead)",
      },
      "wait-for-image": {
        name: "waitForImage",
        /**
         * Wait for image to appear on screen
         * @deprecated Use find() in a polling loop instead
         * @param {Object|string} options - Options object or description (legacy positional)
         * @param {string} options.description - Description of the image
         * @param {number} [options.timeout=10000] - Timeout in milliseconds
         * @returns {Promise<void>}
         */
        doc: "Wait for image to appear on screen (deprecated - use find() in a loop instead)",
      },
      "scroll-until-text": {
        name: "scrollUntilText",
        /**
         * Scroll until text is found
         * @param {Object|string} options - Options object or text (legacy positional)
         * @param {string} options.text - Text to find
         * @param {ScrollDirection} [options.direction='down'] - Scroll direction
         * @param {number} [options.maxDistance=10000] - Maximum distance to scroll in pixels
         * @param {boolean} [options.invert=false] - Invert the match
         * @returns {Promise<void>}
         */
        doc: "Scroll until text is found",
      },
      "scroll-until-image": {
        name: "scrollUntilImage",
        /**
         * Scroll until image is found
         * @param {Object|string} [options] - Options object or description (legacy positional)
         * @param {string} [options.description] - Description of the image
         * @param {ScrollDirection} [options.direction='down'] - Scroll direction
         * @param {number} [options.maxDistance=10000] - Maximum distance to scroll in pixels
         * @param {string} [options.method='mouse'] - Scroll method
         * @param {string} [options.path] - Path to image template
         * @param {boolean} [options.invert=false] - Invert the match
         * @returns {Promise<void>}
         */
        doc: "Scroll until image is found",
      },
      "focus-application": {
        name: "focusApplication",
        /**
         * Focus an application by name
         * @param {string} name - Application name
         * @param {Object} [options] - Additional options (reserved for future use)
         * @returns {Promise<string>}
         */
        doc: "Focus an application by name",
      },
      remember: {
        name: "remember",
        /**
         * Extract and remember information from the screen using AI
         * @param {Object|string} options - Options object or description (legacy positional)
         * @param {string} options.description - What to remember
         * @returns {Promise<string>}
         */
        doc: "Extract and remember information from the screen",
      },
      assert: {
        name: "assert",
        /**
         * Make an AI-powered assertion
         * @param {string} assertion - Assertion to check
         * @param {Object} [options] - Additional options (reserved for future use)
         * @returns {Promise<boolean>}
         */
        doc: "Make an AI-powered assertion",
      },
      exec: {
        name: "exec",
        /**
         * Execute code in the sandbox
         * @param {Object|ExecLanguage} options - Options object or language (legacy positional)
         * @param {ExecLanguage} [options.language='pwsh'] - Language ('js', 'pwsh', or 'sh')
         * @param {string} options.code - Code to execute
         * @param {number} [options.timeout] - Timeout in milliseconds
         * @param {boolean} [options.silent=false] - Suppress output
         * @returns {Promise<string>}
         */
        doc: "Execute code in the sandbox",
      },
    };

    // Create SDK methods dynamically from commands
    Object.keys(this.commands).forEach((commandName) => {
      const command = this.commands[commandName];
      const methodInfo = commandMapping[commandName];

      if (!methodInfo) {
        // Skip commands not in mapping
        return;
      }

      const methodName = methodInfo.name;

      // Create the wrapper method with proper stack trace handling
      this[methodName] = async function (...args) {
        this._ensureConnected();

        // Capture the call site for better error reporting
        const callSite = {};
        Error.captureStackTrace(callSite, this[methodName]);

        try {
          return await command(...args);
        } catch (error) {
          // Ensure we have a proper Error object with a message
          let properError = error;
          if (!(error instanceof Error)) {
            // If it's not an Error object, create one with a proper message
            const errorMessage =
              error?.message || error?.reason || JSON.stringify(error);
            properError = new Error(errorMessage);
            // Preserve additional properties
            if (error?.code) properError.code = error.code;
            if (error?.fullError) properError.fullError = error.fullError;
          }

          // Replace the stack trace to point to the actual caller instead of SDK internals
          if (Error.captureStackTrace && callSite.stack) {
            // Preserve the error message but use the captured call site stack
            const errorMessage = properError.stack?.split("\n")[0];
            const callerStack = callSite.stack?.split("\n").slice(1); // Skip "Error" line
            properError.stack = errorMessage + "\n" + callerStack.join("\n");
          }
          throw properError;
        }
      }.bind(this);

      // Preserve the original function's name for better debugging
      Object.defineProperty(this[methodName], "name", {
        value: methodName,
        writable: false,
      });
    });
  }

  // ====================================
  // Helper Methods
  // ====================================

  /**
   * Capture a screenshot of the current screen
   * @param {number} [scale=1] - Scale factor for the screenshot (1 = original size)
   * @param {boolean} [silent=false] - Whether to suppress logging
   * @param {boolean} [mouse=false] - Whether to include mouse cursor
   * @returns {Promise<string>} Base64 encoded PNG screenshot
   *
   * @example
   * // Capture a screenshot
   * const screenshot = await client.screenshot();
   * fs.writeFileSync('screenshot.png', Buffer.from(screenshot, 'base64'));
   *
   * @example
   * // Capture with mouse cursor visible
   * const screenshot = await client.screenshot(1, false, true);
   */
  async screenshot(scale = 1, silent = false, mouse = false) {
    this._ensureConnected();
    return await this.system.captureScreenBase64(scale, silent, mouse);
  }

  /**
   * Ensure the SDK is connected before running commands
   * @private
   */
  _ensureConnected() {
    if (!this.connected) {
      throw new Error("SDK is not connected. Call connect() first.");
    }
  }

  /**
   * Get the current sandbox instance details
   * @returns {Object|null} Sandbox instance
   */
  getInstance() {
    return this.instance;
  }

  /**
   * Enable or disable logging output
   * @param {boolean} enabled - Whether to enable logging
   */
  setLogging(enabled) {
    this.loggingEnabled = enabled;
    if (enabled && !this._loggingSetup) {
      this._setupLogging();
    }
  }

  /**
   * Get the event emitter for custom event handling
   * @returns {EventEmitter2} Event emitter
   */
  getEmitter() {
    return this.emitter;
  }

  /**
   * Set test context for enhanced logging (integrates with Vitest)
   * @param {Object} context - Test context with file, test name, start time
   * @param {string} [context.file] - Current test file name
   * @param {string} [context.test] - Current test name
   * @param {number} [context.startTime] - Test start timestamp
   */
  setTestContext(context) {
    formatter.setTestContext(context);
  }

  /**
   * Set up logging for the SDK
   * @private
   */
  _setupLogging() {
    // Track the last fatal error message to throw on exit
    let lastFatalError = null;

    // Set up markdown logger
    createMarkdownLogger(this.emitter);

    // Set up basic event logging
    this.emitter.on("log:**", (message) => {
      const event = this.emitter.event;
      if (event === events.log.debug) return;
      if (this.loggingEnabled && message) {
        const prefixedMessage = this.testContext
          ? `[${this.testContext}] ${message}`
          : message;
        console.log(prefixedMessage);
        
        // Also forward to sandbox for dashcam
        this._forwardLogToSandbox(prefixedMessage);
      }
    });

    this.emitter.on("error:**", (data) => {
      if (this.loggingEnabled) {
        const event = this.emitter.event;
        console.error(event, ":", data);
        
        // Capture fatal errors
        if (event === events.error.fatal) {
          lastFatalError = data;
        }
      }
    });

    this.emitter.on("status", (message) => {
      if (this.loggingEnabled) {
        console.log(`- ${message}`);
      }
    });

    // Handle redraw status for debugging scroll and other async operations
    this.emitter.on("redraw:status", (status) => {
      if (this.loggingEnabled) {
        console.log(
          `[redraw] screen:${status.redraw.text} network:${status.network.text} timeout:${status.timeout.text}`,
        );
      }
    });

    this.emitter.on("redraw:complete", (info) => {
      if (this.loggingEnabled) {
        console.log(
          `[redraw complete] screen:${info.screenHasRedrawn} network:${info.networkSettled} timeout:${info.isTimeout} elapsed:${info.timeElapsed}ms`,
        );
      }
    });

    // Handle exit events - throw error with meaningful message instead of calling process.exit
    // This allows test frameworks like Vitest to properly catch and display the error
    this.emitter.on(events.exit, (exitCode) => {
      if (exitCode !== 0) {
        // Create an error with the fatal error message if available
        const errorMessage = lastFatalError || 'TestDriver fatal error';
        const error = new Error(errorMessage);
        error.name = 'TestDriverFatalError';
        error.exitCode = exitCode;
        throw error;
      }
    });

    // Handle show window events for sandbox visualization
    this.emitter.on("show-window", async (url) => {
      if (this.loggingEnabled) {
        console.log("");
        console.log("Live test execution:");
        if (this.config.CI) {
          // In CI mode, just print the view-only URL
          const u = new URL(url);
          const encodedData = u.searchParams.get("data");
          // Data is base64 encoded, not URL encoded
          const data = JSON.parse(
            Buffer.from(encodedData, "base64").toString(),
          );
          console.log(`${data.url}&view_only=true`);
        } else {
          // In local mode, print the URL and open it in the browser
          console.log(url);
          await this._openBrowser(url);
        }
      }
    });
  }

  /**
   * Forward log message to sandbox for debugger display
   * @private
   * @param {string} message - Log message to forward
   */
  _forwardLogToSandbox(message) {
    try {
      // Only forward if sandbox is connected
      if (this.sandbox && this.sandbox.instanceSocketConnected) {
        // Don't send objects as they cause base64 encoding errors
        if (typeof message === "object") {
          return;
        }

        // Add test context prefix if available
        const prefixedMessage = this.testContext
          ? `[${this.testContext}] ${message}`
          : message;

        this.sandbox.send({
          type: "output",
          output: Buffer.from(prefixedMessage).toString("base64"),
        });
      }
    } catch {
      // Silently fail to avoid breaking the log flow
      // console.error("Error forwarding log to sandbox:", error);
    }
  }

  /**
   * Open URL in default browser
   * @private
   * @param {string} url - URL to open
   */
  async _openBrowser(url) {
    try {
      // Use dynamic import for the 'open' package (ES module)
      const { default: open } = await import("open");

      // Open the browser
      await open(url, {
        wait: false,
      });
    } catch (error) {
      const { events } = require("./agent/events.js");
      this.emitter.emit(
        events.log.log,
        `Failed to open browser automatically: ${error.message}`,
      );
      this.emitter.emit(events.log.log, `Please manually open: ${url}`);
    }
  }

  /**
   * Initialize debugger server
   * @private
   */
  async _initializeDebugger() {
    // Import createDebuggerProcess at the module level if not already done
    const { createDebuggerProcess } = require("./agent/lib/debugger.js");

    // Only initialize once
    if (!this.agent.debuggerUrl) {
      const debuggerProcess = await createDebuggerProcess(
        this.config,
        this.emitter,
      );
      this.agent.debuggerUrl = debuggerProcess.url || null;
    }
  }

  // ====================================
  // Test Recording Methods
  // ====================================

  /**
   * Create a new test run to track test execution
   *
   * @param {Object} options - Test run configuration
   * @param {string} options.runId - Unique identifier for this test run
   * @param {string} options.suiteName - Name of the test suite
   * @param {string} [options.platform] - Platform (windows/mac/linux)
   * @param {string} [options.sandboxId] - Sandbox ID (auto-detected from session if not provided)
   * @param {Object} [options.ci] - CI/CD metadata
   * @param {Object} [options.git] - Git metadata
   * @param {Object} [options.env] - Environment metadata
   * @returns {Promise<Object>} Created test run
   *
   * @example
   * const testRun = await client.createTestRun({
   *   runId: 'unique-run-id',
   *   suiteName: 'My Test Suite',
   *   platform: 'windows',
   *   git: {
   *     repo: 'myorg/myrepo',
   *     branch: 'main',
   *     commit: 'abc123'
   *   }
   * });
   */
  async createTestRun(options) {
    this._ensureConnected();

    const { createSDK } = require("./agent/lib/sdk.js");
    const sdk = createSDK(
      this.emitter,
      this.config,
      this.agent.sessionInstance,
    );
    await sdk.auth();

    const platform = options.platform || this.config.TD_PLATFORM || "linux";

    // Auto-detect sandbox ID from the active sandbox if not provided
    const sandboxId = options.sandboxId || this.agent?.sandbox?.id || null;

    // Get or create session ID using the agent's newSession method
    let sessionId = this.agent?.sessionInstance?.get() || null;
    
    // If no session exists, create one using the agent's method
    if (!sessionId && this.agent?.newSession) {
      try {
        await this.agent.newSession();
        sessionId = this.agent.sessionInstance.get();
        
        // Save session ID to file for reuse across test runs
        if (sessionId) {
          const sessionFile = path.join(os.homedir(), '.testdriverai-session');
          fs.writeFileSync(sessionFile, sessionId, { encoding: 'utf-8' });
        }
      } catch (error) {
        // Log but don't fail - tests can run without a session
        console.warn('Failed to create session:', error.message);
      }
    }
    
    // If still no session, try reading from file (for reporter/separate processes)
    if (!sessionId) {
      try {
        const sessionFile = path.join(os.homedir(), '.testdriverai-session');
        if (fs.existsSync(sessionFile)) {
          sessionId = fs.readFileSync(sessionFile, 'utf-8').trim();
        }
      } catch (error) {
        // Ignore file read errors
      }
    }

    const data = {
      runId: options.runId,
      suiteName: options.suiteName,
      platform,
      sandboxId: sandboxId,
      sessionId: sessionId,
      // CI/CD
      ciProvider: options.ci?.provider,
      ciRunId: options.ci?.runId,
      ciJobId: options.ci?.jobId,
      ciUrl: options.ci?.url,
      // Git
      repo: options.git?.repo,
      branch: options.git?.branch,
      commit: options.git?.commit,
      commitMessage: options.git?.commitMessage,
      author: options.git?.author,
      // Environment
      nodeVersion: options.env?.nodeVersion || process.version,
      testDriverVersion:
        options.env?.testDriverVersion || require("./package.json").version,
      vitestVersion: options.env?.vitestVersion,
      environment: options.env?.additional,
    };

    const result = await sdk.req("/api/v1/testdriver/test-run-create", data);
    return result.data;
  }

  /**
   * Complete a test run and update final statistics
   *
   * @param {Object} options - Test run completion data
   * @param {string} options.runId - Test run ID
   * @param {string} options.status - Final status (passed/failed/cancelled)
   * @param {number} [options.totalTests] - Total number of tests
   * @param {number} [options.passedTests] - Number of passed tests
   * @param {number} [options.failedTests] - Number of failed tests
   * @param {number} [options.skippedTests] - Number of skipped tests
   * @returns {Promise<Object>} Updated test run
   *
   * @example
   * await client.completeTestRun({
   *   runId: 'unique-run-id',
   *   status: 'passed',
   *   totalTests: 10,
   *   passedTests: 10,
   *   failedTests: 0
   * });
   */
  async completeTestRun(options) {
    this._ensureConnected();

    const { createSDK } = require("./agent/lib/sdk.js");
    const sdk = createSDK(
      this.emitter,
      this.config,
      this.agent.sessionInstance,
    );
    await sdk.auth();

    const result = await sdk.req(
      "/api/v1/testdriver/test-run-complete",
      options,
    );
    return result.data;
  }

  /**
   * Record a test case result
   *
   * @param {Object} options - Test case data
   * @param {string} options.runId - Test run ID
   * @param {string} options.testName - Name of the test
   * @param {string} options.testFile - Path to test file
   * @param {string} options.status - Test status (passed/failed/skipped/pending)
   * @param {string} [options.suiteName] - Test suite/describe block name
   * @param {number} [options.duration] - Test duration in ms
   * @param {string} [options.errorMessage] - Error message if failed
   * @param {string} [options.errorStack] - Error stack trace if failed
   * @param {string} [options.replayUrl] - Dashcam replay URL
   * @param {number} [options.replayStartTime] - Start time in replay
   * @param {number} [options.replayEndTime] - End time in replay
   * @returns {Promise<Object>} Created/updated test case
   *
   * @example
   * await client.recordTestCase({
   *   runId: 'unique-run-id',
   *   testName: 'should login successfully',
   *   testFile: 'tests/login.test.js',
   *   status: 'passed',
   *   duration: 1500,
   *   replayUrl: 'https://app.dashcam.io/replay/abc123'
   * });
   */
  async recordTestCase(options) {
    this._ensureConnected();

    const { createSDK } = require("./agent/lib/sdk.js");
    const sdk = createSDK(
      this.emitter,
      this.config,
      this.agent.sessionInstance,
    );
    await sdk.auth();

    const result = await sdk.req(
      "/api/v1/testdriver/test-case-create",
      options,
    );
    return result.data;
  }

  // ====================================
  // AI Methods (Exploratory Loop)
  // ====================================

  /**
   * Execute a natural language task using AI
   * This is the SDK equivalent of the CLI's exploratory loop
   *
   * @param {string} task - Natural language description of what to do
   * @param {Object} options - Execution options
   * @param {boolean} [options.validateAndLoop=false] - Whether to validate completion and retry if incomplete
   * @returns {Promise<string|void>} Final AI response if validateAndLoop is true
   *
   * @example
   * // Simple execution
   * await client.act('Click the submit button');
   *
   * @example
   * // With validation loop
   * const result = await client.act('Fill out the contact form', { validateAndLoop: true });
   * console.log(result); // AI's final assessment
   */
  async act(task) {
    this._ensureConnected();

    this.analytics.track("sdk.act", { task });

    // Use the agent's exploratoryLoop method directly
    return await this.agent.exploratoryLoop(task, false, true, false);
  }

  /**
   * @deprecated Use act() instead
   * Execute a natural language task using AI
   *
   * @param {string} task - Natural language description of what to do
   * @param {Object} options - Execution options
   * @param {boolean} [options.validateAndLoop=false] - Whether to validate completion and retry if incomplete
   * @returns {Promise<string|void>} Final AI response if validateAndLoop is true
   */
  async ai(task) {
    return await this.act(task);
  }
}

module.exports = TestDriverSDK;
module.exports.Element = Element;
module.exports.ElementNotFoundError = ElementNotFoundError;
