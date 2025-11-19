#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");
const { formatter } = require("./sdk-log-formatter");

/**
 * Custom error class for element operation failures
 * Includes debugging information like screenshots and AI responses
 */
class ElementNotFoundError extends Error {
  constructor(message, debugInfo = {}) {
    super(message);
    this.name = "ElementNotFoundError";
    this.screenshot = debugInfo.screenshot;
    this.aiResponse = debugInfo.aiResponse;
    this.description = debugInfo.description;
    this.timestamp = new Date().toISOString();
    this.screenshotPath = null;

    // Capture stack trace but skip internal frames
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ElementNotFoundError);
    }

    // Write screenshot to temp directory
    if (this.screenshot) {
      try {
        const tempDir = path.join(os.tmpdir(), "testdriver-debug");
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const filename = `screenshot-${Date.now()}.png`;
        this.screenshotPath = path.join(tempDir, filename);

        // Remove data:image/png;base64, prefix if present
        const base64Data = this.screenshot.replace(
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
   * @param {number} [cacheThreshold] - Cache threshold for this specific find (overrides global setting)
   * @returns {Promise<Element>} This element instance
   */
  async find(newDescription, cacheThreshold) {
    this.sdk._checkAborted();
    const description = newDescription || this.description;
    if (newDescription) {
      this.description = newDescription;
    }

    const startTime = Date.now();

    const debugMode =
      process.env.VERBOSE || process.env.DEBUG || process.env.TD_DEBUG;

    try {
      const screenshot = await this.system.captureScreenBase64();
      // Only store screenshot in DEBUG mode to prevent memory leaks
      if (debugMode) {
        this._screenshot = screenshot;
      }

      // Use per-command threshold if provided, otherwise fall back to global threshold
      const threshold =
        cacheThreshold ?? this.sdk.cacheThresholds?.find ?? 0.05;

      // Store the threshold for debugging
      this._threshold = threshold;

      // Debug log threshold
      if (debugMode) {
        const { events } = require("./agent/events.js");
        this.sdk.emitter.emit(
          events.log.debug,
          `🔍 find() threshold: ${threshold} (cache ${threshold < 0 ? "DISABLED" : "ENABLED"})`,
        );
      }

      const response = await this.sdk.apiClient.req("find", {
        element: description,
        image: screenshot,
        threshold: threshold,
        os: this.sdk.os,
        resolution: this.sdk.resolution,
      });

      const duration = Date.now() - startTime;

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
      }
    } catch (error) {
      this._response = error.response
        ? this._sanitizeResponse(error.response)
        : null;
      this._found = false;
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
    this.sdk._checkAborted();
    if (!this._found || !this.coordinates) {
      throw new ElementNotFoundError(
        `Element "${this.description}" not found.`,
        {
          description: this.description,
          screenshot: this._screenshot,
          aiResponse: this._response,
          threshold: this._threshold,
          cachedImageUrl: this._response?.cachedImageUrl,
          pixelDiffImage: this._response?.pixelDiffImage,
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

    if (action === "hover") {
      await this.commands.hover(this.coordinates.x, this.coordinates.y);
    } else {
      await this.commands.click(this.coordinates.x, this.coordinates.y, action);
    }
  }

  /**
   * Hover over the element
   * @returns {Promise<void>}
   */
  async hover() {
    this.sdk._checkAborted();
    if (!this._found || !this.coordinates) {
      throw new ElementNotFoundError(
        `Element "${this.description}" not found.`,
        {
          description: this.description,
          screenshot: this._screenshot,
          aiResponse: this._response,
          threshold: this._threshold,
          cachedImageUrl: this._response?.cachedImageUrl,
          pixelDiffImage: this._response?.pixelDiffImage,
        },
      );
    }

    // Log the hover action
    const { events } = require("./agent/events.js");
    const formattedMessage = formatter.formatAction("hover", this.description);
    this.sdk.emitter.emit(events.log.log, formattedMessage);

    await this.commands.hover(this.coordinates.x, this.coordinates.y);
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
        signal: options.signal || null,
      },
    });

    // Store options for later use
    this.options = options;

    // Store os and resolution for API requests
    this.os = options.os || "linux";
    this.resolution = options.resolution || "1366x768";

    // Set up abort signal if provided
    this.signal = options.signal || null;
    this._aborted = false;
    if (this.signal) {
      this.signal.addEventListener("abort", () => {
        this._aborted = true;
        this._handleAbort();
      });
    }

    // Store newSandbox preference from options
    this.newSandbox =
      options.newSandbox !== undefined ? options.newSandbox : false;

    // Store headless preference from options
    this.headless = options.headless !== undefined ? options.headless : false;

    // Cache threshold configuration
    // threshold = pixel difference allowed (0.05 = 5% difference, 95% similarity)
    // cache: false option disables cache completely by setting threshold to -1
    // Also support TD_NO_CACHE environment variable
    const useCache =
      options.cache !== false && process.env.TD_NO_CACHE !== "true";

    // Note: Cannot emit events here as emitter is not yet available
    // Logging will be done after connection

    if (!useCache) {
      // If cache is disabled, use -1 to bypass cache entirely
      this.cacheThresholds = {
        find: -1,
        findAll: -1,
      };
    } else {
      // Use configured thresholds or defaults
      this.cacheThresholds = {
        find: options.cacheThreshold?.find ?? 0.05,
        findAll: options.cacheThreshold?.findAll ?? 0.05,
      };
    }

    // Redraw threshold configuration
    // threshold = percentage of pixels that must change to consider screen redrawn (0.1 = 0.1%)
    this.redrawThreshold = options.redrawThreshold ?? 0.1;

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
  }

  /**
   * Check if operation has been aborted
   * @private
   * @throws {Error} If aborted
   */
  _checkAborted() {
    if (this._aborted) {
      throw new Error("Operation aborted");
    }
  }

  /**
   * Handle abort signal
   * @private
   */
  async _handleAbort() {
    const { events } = require("./agent/events.js");
    this.emitter.emit(
      events.log.log,
      "⚠️  TestDriver SDK: Abort signal received, cleaning up...",
    );
    try {
      if (this.connected) {
        await this.disconnect();
      }
    } catch (error) {
      this.emitter.emit(
        events.log.log,
        `Error during abort cleanup: ${error.message}`,
      );
    }
  }

  /**
   * Authenticate with TestDriver API
   * @returns {Promise<string>} Authentication token
   */
  async auth() {
    this._checkAborted();
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
    this._checkAborted();
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
    if (connectOptions.ip) {
      this.agent.ip = connectOptions.ip;
    }
    if (connectOptions.sandboxAmi) {
      this.agent.sandboxAmi = connectOptions.sandboxAmi;
    }
    if (connectOptions.sandboxInstance) {
      this.agent.sandboxInstance = connectOptions.sandboxInstance;
    }
    if (connectOptions.os) {
      this.agent.sandboxOs = connectOptions.os;
    }

    // Set redrawThreshold on agent's cliArgs.options
    this.agent.cliArgs.options.redrawThreshold = this.redrawThreshold;

    // Use the agent's buildEnv method which handles all the connection logic
    await this.agent.buildEnv(buildEnvOptions);

    // Get the instance from the agent
    this.instance = this.agent.instance;

    // Expose the agent's commands, parser, and commander
    this.commands = this.agent.commands;

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
    if (this.connected && this.instance) {
      // Track disconnect event
      this.analytics.track("sdk.disconnect");

      this.connected = false;
      this.instance = null;
    }
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
   * @param {number} [cacheThreshold] - Cache threshold for this specific find (overrides global setting)
   * @returns {Promise<Element>} Element instance that has been located
   *
   * @example
   * // Find and click immediately
   * const element = await client.find('the sign in button');
   * await element.click();
   *
   * @example
   * // Find with custom cache threshold
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
  async find(description, cacheThreshold) {
    this._checkAborted();
    this._ensureConnected();
    const element = new Element(description, this, this.system, this.commands);
    return await element.find(null, cacheThreshold);
  }

  /**
   * Find all elements matching a description
   * Automatically locates all matching elements and returns them as an array
   *
   * @param {string} description - Description of the elements to find
   * @param {number} [cacheThreshold] - Cache threshold for this specific findAll (overrides global setting)
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
   * // Find all list items with custom cache threshold
   * const items = await client.findAll('list item', 0.01);
   * for (const item of items) {
   *   console.log(`Found item at (${item.x}, ${item.y})`);
   * }
   */
  async findAll(description, cacheThreshold) {
    this._checkAborted();
    this._ensureConnected();

    const startTime = Date.now();

    try {
      const screenshot = await this.system.captureScreenBase64();

      // Use per-command threshold if provided, otherwise fall back to global threshold
      const threshold = cacheThreshold ?? this.cacheThresholds?.findAll ?? 0.05;

      const response = await this.apiClient.req(
        "/api/v7.0.0/testdriver-agent/testdriver-find-all",
        {
          element: description,
          image: screenshot,
          threshold: threshold,
          os: this.os,
          resolution: this.resolution,
        },
      );

      const duration = Date.now() - startTime;

      if (response && response.elements && response.elements.length > 0) {
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
        // No elements found - return empty array
        return [];
      }
    } catch (error) {
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
    const commandMapping = {
      "hover-text": {
        name: "hoverText",
        /**
         * Hover over text on screen
         * @deprecated Use find() and element.click() instead
         * @param {string} text - Text to find and hover over
         * @param {string | null} [description] - Optional description of the element
         * @param {ClickAction} [action='click'] - Action to perform
         * @param {TextMatchMethod} [method='turbo'] - Text matching method
         * @param {number} [timeout=5000] - Timeout in milliseconds
         * @returns {Promise<{x: number, y: number, centerX: number, centerY: number}>}
         */
        doc: "Hover over text on screen (deprecated - use find() instead)",
      },
      "hover-image": {
        name: "hoverImage",
        /**
         * Hover over an image on screen
         * @deprecated Use find() and element.click() instead
         * @param {string} description - Description of the image to find
         * @param {ClickAction} [action='click'] - Action to perform
         * @returns {Promise<{x: number, y: number, centerX: number, centerY: number}>}
         */
        doc: "Hover over an image on screen (deprecated - use find() instead)",
      },
      "match-image": {
        name: "matchImage",
        /**
         * Match and interact with an image template
         * @param {string} imagePath - Path to the image template
         * @param {ClickAction} [action='click'] - Action to perform
         * @param {boolean} [invert=false] - Invert the match
         * @returns {Promise<boolean>}
         */
        doc: "Match and interact with an image template",
      },
      type: {
        name: "type",
        /**
         * Type text
         * @param {string | number} text - Text to type
         * @param {number} [delay=250] - Delay between keystrokes in milliseconds
         * @returns {Promise<void>}
         */
        doc: "Type text",
      },
      "press-keys": {
        name: "pressKeys",
        /**
         * Press keyboard keys
         * @param {KeyboardKey[]} keys - Array of keys to press
         * @returns {Promise<void>}
         */
        doc: "Press keyboard keys",
      },
      click: {
        name: "click",
        /**
         * Click at coordinates
         * @param {number} x - X coordinate
         * @param {number} y - Y coordinate
         * @param {ClickAction} [action='click'] - Type of click action
         * @returns {Promise<void>}
         */
        doc: "Click at coordinates",
      },
      hover: {
        name: "hover",
        /**
         * Hover at coordinates
         * @param {number} x - X coordinate
         * @param {number} y - Y coordinate
         * @returns {Promise<void>}
         */
        doc: "Hover at coordinates",
      },
      scroll: {
        name: "scroll",
        /**
         * Scroll the page
         * @param {ScrollDirection} [direction='down'] - Direction to scroll
         * @param {number} [amount=300] - Amount to scroll in pixels
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
         * @returns {Promise<void>}
         */
        doc: "Wait for specified time (deprecated - consider element polling instead)",
      },
      "wait-for-text": {
        name: "waitForText",
        /**
         * Wait for text to appear on screen
         * @deprecated Use find() in a polling loop instead
         * @param {string} text - Text to wait for
         * @param {number} [timeout=5000] - Timeout in milliseconds
         * @param {TextMatchMethod} [method='turbo'] - Text matching method
         * @param {boolean} [invert=false] - Invert the match (wait for text to disappear)
         * @returns {Promise<void>}
         */
        doc: "Wait for text to appear on screen (deprecated - use find() in a loop instead)",
      },
      "wait-for-image": {
        name: "waitForImage",
        /**
         * Wait for image to appear on screen
         * @deprecated Use find() in a polling loop instead
         * @param {string} description - Description of the image
         * @param {number} [timeout=10000] - Timeout in milliseconds
         * @param {boolean} [invert=false] - Invert the match (wait for image to disappear)
         * @returns {Promise<void>}
         */
        doc: "Wait for image to appear on screen (deprecated - use find() in a loop instead)",
      },
      "scroll-until-text": {
        name: "scrollUntilText",
        /**
         * Scroll until text is found
         * @param {string} text - Text to find
         * @param {ScrollDirection} [direction='down'] - Scroll direction
         * @param {number} [maxDistance=10000] - Maximum distance to scroll in pixels
         * @param {TextMatchMethod} [textMatchMethod='turbo'] - Text matching method
         * @param {ScrollMethod} [method='keyboard'] - Scroll method
         * @param {boolean} [invert=false] - Invert the match
         * @returns {Promise<void>}
         */
        doc: "Scroll until text is found",
      },
      "scroll-until-image": {
        name: "scrollUntilImage",
        /**
         * Scroll until image is found
         * @param {string} description - Description of the image (or use path parameter)
         * @param {ScrollDirection} [direction='down'] - Scroll direction
         * @param {number} [maxDistance=10000] - Maximum distance to scroll in pixels
         * @param {ScrollMethod} [method='keyboard'] - Scroll method
         * @param {string | null} [path=null] - Path to image template
         * @param {boolean} [invert=false] - Invert the match
         * @returns {Promise<void>}
         */
        doc: "Scroll until image is found",
      },
      "focus-application": {
        name: "focusApplication",
        /**
         * Focus an application by name
         * @param {string} name - Application name
         * @returns {Promise<string>}
         */
        doc: "Focus an application by name",
      },
      remember: {
        name: "remember",
        /**
         * Extract and remember information from the screen using AI
         * @param {string} description - What to remember
         * @returns {Promise<string>}
         */
        doc: "Extract and remember information from the screen",
      },
      assert: {
        name: "assert",
        /**
         * Make an AI-powered assertion
         * @param {string} assertion - Assertion to check
         * @returns {Promise<boolean>}
         */
        doc: "Make an AI-powered assertion",
      },
      exec: {
        name: "exec",
        /**
         * Execute code in the sandbox
         * @param {ExecLanguage} language - Language ('js' or 'pwsh')
         * @param {string} code - Code to execute
         * @param {number} timeout - Timeout in milliseconds
         * @param {boolean} [silent=false] - Suppress output
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
    this._checkAborted();
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
      }
    });

    this.emitter.on("error:**", (data) => {
      if (this.loggingEnabled) {
        const event = this.emitter.event;
        console.error(event, ":", data);
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

    const platform = options.platform || this.config.TD_PLATFORM || "windows";

    // Auto-detect sandbox ID from the active sandbox if not provided
    const sandboxId = options.sandboxId || this.agent?.sandbox?.id || null;

    // Get session ID from the agent's session instance
    const sessionId = this.agent?.sessionInstance?.get() || null;

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
   * await client.ai('Click the submit button');
   *
   * @example
   * // With validation loop
   * const result = await client.ai('Fill out the contact form', { validateAndLoop: true });
   * console.log(result); // AI's final assessment
   */
  async ai(task) {
    this._ensureConnected();

    this.analytics.track("sdk.ai", { task });

    // Use the agent's exploratoryLoop method directly
    return await this.agent.exploratoryLoop(task, false, true, false);
  }
}

module.exports = TestDriverSDK;
module.exports.Element = Element;
module.exports.ElementNotFoundError = ElementNotFoundError;
