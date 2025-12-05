// the actual commands to interact with the system
const { createSDK } = require("./sdk.js");
const vm = require("vm");
const theme = require("./theme.js");

const fs = require("fs").promises; // Using the promises version for async operations
const { findTemplateImage } = require("./subimage/index");
const path = require("path");
const Jimp = require("jimp");
const os = require("os");
const cliProgress = require("cli-progress");
const { createRedraw } = require("./redraw.js");

const { events } = require("../events.js");

/**
 * Helper to detect if arguments are using object-based API or positional API
 * @param {Array} args - The arguments passed to a command
 * @param {Array<string>} knownKeys - Keys that would be present in object-based call
 * @returns {boolean} True if using object-based API
 */
const isObjectArgs = (args, knownKeys) => {
  if (args.length === 0) return false;
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && !Array.isArray(args[0])) {
    // Check if it has at least one known key
    return knownKeys.some(key => key in args[0]);
  }
  return false;
};

/**
 * Error When a match is not found
 * these should be recoverable by --heal
 **/
class MatchError extends Error {
  constructor(message, fatal = false) {
    super(message);
    this.fatal = fatal;
    this.attachScreenshot = true;
  }
}

/**
 * Error when something is wrong with th command
 **/
class CommandError extends Error {
  constructor(message) {
    super(message);
    this.fatal = true;
    this.attachScreenshot = false;
  }
}

/**
 * Extract redraw options from command options
 * @param {Object} options - Command options that may contain redraw settings
 * @returns {Object} Redraw options object
 */
const extractRedrawOptions = (options = {}) => {
  const redrawOpts = {};
  
  // Support nested redraw object: { redraw: { enabled: false, diffThreshold: 0.5 } }
  if (options.redraw && typeof options.redraw === 'object') {
    return options.redraw;
  }
  
  // Support flat options for convenience
  if ('redrawEnabled' in options) redrawOpts.enabled = options.redrawEnabled;
  if ('redrawScreenRedraw' in options) redrawOpts.screenRedraw = options.redrawScreenRedraw;
  if ('redrawNetworkMonitor' in options) redrawOpts.networkMonitor = options.redrawNetworkMonitor;
  if ('redrawDiffThreshold' in options) redrawOpts.diffThreshold = options.redrawDiffThreshold;
  
  return redrawOpts;
};

// Factory function that creates commands with the provided emitter
const createCommands = (
  emitter,
  system,
  sandbox,
  config,
  sessionInstance,
  getCurrentFilePath,
  redrawThreshold = 0.01,
  getDashcamElapsedTime = null,
) => {
  // Create SDK instance with emitter, config, and session
  const sdk = createSDK(emitter, config, sessionInstance);
  // Create redraw instance with the system - support both number and object for backward compatibility
  const defaultRedrawOptions = typeof redrawThreshold === 'number' 
    ? { diffThreshold: redrawThreshold }
    : redrawThreshold;
  const redraw = createRedraw(emitter, system, sandbox, defaultRedrawOptions);

  // Helper method to resolve file paths relative to the current file
  const resolveRelativePath = (relativePath) => {
    // If it's already an absolute path, return as-is
    if (path.isAbsolute(relativePath)) {
      return relativePath;
    }

    // Get the current file path dynamically
    const currentFilePath = getCurrentFilePath();

    // For relative paths, resolve relative to the current file's directory
    if (currentFilePath) {
      return path.resolve(path.dirname(currentFilePath), relativePath);
    }

    // Fallback to workingDir
    return path.resolve(config.TD_WORKING_DIR || process.cwd(), relativePath);
  };

  const niceSeconds = (ms) => {
    return Math.round(ms / 1000);
  };
  const delay = (t) => new Promise((resolve) => setTimeout(resolve, t));

  const findImageOnScreen = async (
    relativePath,
    haystack,
    restrictToWindow,
  ) => {
    // add .png to relative path if not already there
    if (!relativePath.endsWith(".png")) {
      relativePath = relativePath + ".png";
    }

    let needle = relativePath;

    // check if the file exists
    if (!fs.access(needle)) {
      throw new CommandError(
        `Image does not exist or do not have access: ${needle}`,
      );
    }

    const bar1 = new cliProgress.SingleBar(
      {},
      cliProgress.Presets.shades_classic,
    );

    let thresholds = [0.9, 0.8, 0.7];

    let scaleFactors = [1, 0.5, 2, 0.75, 1.25, 1.5];

    let result = null;
    let highestThreshold = 0;

    let totalOperations = thresholds.length * scaleFactors.length;
    bar1.start(totalOperations, 0);

    for (let scaleFactor of scaleFactors) {
      let needleSize = 1 / scaleFactor;

      const scaledNeedle = await Jimp.read(path.join(needle));
      scaledNeedle.scale(needleSize);

      const haystackImage = await Jimp.read(haystack);

      if (
        scaledNeedle.bitmap.width > haystackImage.bitmap.width ||
        scaledNeedle.bitmap.height > haystackImage.bitmap.height
      ) {
        // Needle is larger than haystack, skip this scale factor
        continue;
      }

      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "scaledNeedle_"));
      const scaledNeedlePath = path.join(
        tempDir,
        `scaledNeedle_${needleSize}.png`,
      );
      await scaledNeedle.writeAsync(scaledNeedlePath);

      for (let threshold of thresholds) {
        if (threshold >= highestThreshold) {
          let results = await findTemplateImage(
            haystack,
            scaledNeedlePath,
            threshold,
          );

          // throw away any results that are not within the active window
          let activeWindow = await system.activeWin();

          // filter out text that is not in the active window
          if (restrictToWindow) {
            results = results.filter((el) => {
              return (
                el.centerX > activeWindow.bounds.x &&
                el.centerX <
                  activeWindow.bounds.x + activeWindow.bounds.width &&
                el.centerY > activeWindow.bounds.y &&
                el.centerY < activeWindow.bounds.y + activeWindow.bounds.height
              );
            });
          }

          if (results.length) {
            result = { ...results[0], threshold, scaleFactor, needleSize };
            highestThreshold = threshold;
            break;
          }
        }

        bar1.increment();
      }
    }

    bar1.stop();

    return result;
  };

  const assert = async (assertion, shouldThrow = false) => {
    const handleAssertResponse = (response) => {
      emitter.emit(events.log.log, response);

      let valid = response.indexOf("The task passed") > -1;

      if (valid) {
        return true;
      } else {
        if (shouldThrow) {
          // Is fatal, otherwise it just changes the assertion to be true
          const errorMessage = `AI Assertion failed: ${assertion}\n${response}`;
          throw new MatchError(errorMessage, true);
        } else {
          return false;
        }
      }
    };

    // Log asserting action
    const { formatter } = require("../../sdk-log-formatter.js");
    const assertingMessage = formatter.formatAsserting(assertion);
    emitter.emit(events.log.log, assertingMessage);

    emitter.emit(events.log.narration, `thinking...`);

    const assertStartTime = Date.now();
    let response = await sdk.req("assert", {
      expect: assertion,
      image: await system.captureScreenBase64(),
    });
    const assertDuration = Date.now() - assertStartTime;
    
    // Determine if assertion passed or failed
    const assertionPassed = response.data.indexOf("The task passed") > -1;
    
    // Track interaction with success/failure
    const sessionId = sessionInstance?.get();
    if (sessionId) {
      try {
        await sandbox.send({
          type: "trackInteraction",
          interactionType: "assert",
          session: sessionId,
          prompt: assertion,
          timestamp: assertStartTime,
          duration: assertDuration,
          success: assertionPassed,
          error: assertionPassed ? undefined : response.data,
        });
      } catch (err) {
        console.warn("Failed to track assert interaction:", err.message);
      }
    }
    
    return handleAssertResponse(response.data);
  };

  /**
   * Scroll the screen in a direction
   * @param {string} [direction='down'] - Direction to scroll ('up', 'down', 'left', 'right')
   * @param {Object} [options] - Additional options
   * @param {number} [options.amount=300] - Amount to scroll in pixels
   * @param {Object} [options.redraw] - Redraw detection options
   * @param {boolean} [options.redraw.enabled=true] - Enable/disable redraw detection
   * @param {boolean} [options.redraw.screenRedraw=true] - Enable/disable screen redraw detection
   * @param {boolean} [options.redraw.networkMonitor=true] - Enable/disable network monitoring
   * @param {number} [options.redraw.diffThreshold=0.1] - Screen diff threshold percentage
   */
  const scroll = async (direction = 'down', options = {}) => {
    // Convert number to object format
    if (typeof options === 'number') {
      options = { amount: options };
    }
    
    let { amount = 300 } = options;
    const redrawOptions = extractRedrawOptions(options);
    
    emitter.emit(
      events.log.narration,
      theme.dim(`scrolling ${direction} ${amount}px...`),
    );

    await redraw.start(redrawOptions);

    amount = parseInt(amount, 10);

    const before = await system.captureScreenBase64();
    switch (direction) {
      case "up":
        await sandbox.send({
          type: "scroll",
          amount,
          direction,
        });
        await redraw.wait(2500, redrawOptions);
        break;
      case "down":
        await sandbox.send({
          type: "scroll",
          amount,
          direction,
        });
        await redraw.wait(2500, redrawOptions);
        break;
      case "left":
        console.error("Not Supported");
        break;
      case "right":
        console.error("Not Supported");
        break;
      default:
        throw new CommandError("Direction not found");
    }
    const after = await system.captureScreenBase64();

    if (before === after) {
      emitter.emit(
        events.log.warn,
        "Attempted to scroll, but the screen did not change.  You may need to click a non-interactive element to focus the scrollable area first.",
      );
    }
  };

  /**
   * Perform a mouse click action
   * @param {Object|number} options - Options object or x coordinate (for backward compatibility)
   * @param {number} options.x - X coordinate
   * @param {number} options.y - Y coordinate
   * @param {string} [options.action='click'] - Click action ('click', 'right-click', 'double-click', 'hover', 'mouseDown', 'mouseUp')
   * @param {string} [options.prompt] - Prompt for tracking
   * @param {boolean} [options.cacheHit] - Whether cache was hit
   * @param {string} [options.selector] - Selector used
   * @param {boolean} [options.selectorUsed] - Whether selector was used
   * @param {Object} [options.redraw] - Redraw detection options
   * @param {boolean} [options.redraw.enabled=true] - Enable/disable redraw detection
   * @param {boolean} [options.redraw.screenRedraw=true] - Enable/disable screen redraw detection
   * @param {boolean} [options.redraw.networkMonitor=true] - Enable/disable network monitoring
   * @param {number} [options.redraw.diffThreshold=0.1] - Screen diff threshold percentage
   */
  const click = async (...args) => {
    const clickStartTime = Date.now();
    let x, y, action, elementData, redrawOptions;
    
    // Handle both object and positional argument styles
    if (isObjectArgs(args, ['x', 'y', 'action', 'prompt', 'cacheHit', 'selector'])) {
      const { x: xPos, y: yPos, action: actionArg = 'click', redraw: redrawOpts, ...rest } = args[0];
      x = xPos;
      y = yPos;
      action = actionArg;
      elementData = rest;
      redrawOptions = extractRedrawOptions({ redraw: redrawOpts, ...rest });
    } else {
      // Legacy positional: click(x, y, action, elementData)
      [x, y, action = 'click', elementData = {}] = args;
      redrawOptions = extractRedrawOptions(elementData);
    }
    
    try {
      await redraw.start(redrawOptions);

      let button = "left";
      let double = false;

      if (action === "right-click") {
        button = "right";
      }
      if (action === "double-click") {
        double = true;
      }

      emitter.emit(
        events.log.narration,
        theme.dim(`${action} ${button} clicking at ${x}, ${y}...`),
        true,
      );

      x = parseInt(x);
      y = parseInt(y);

      // Add dashcam timestamp if available
      if (getDashcamElapsedTime) {
        const elapsed = getDashcamElapsedTime();
        if (elapsed !== null) {
          elementData.timestamp = elapsed;
        }
      }

      await sandbox.send({ type: "moveMouse", x, y, ...elementData });

      emitter.emit(events.mouseMove, { x, y });

      await delay(2500); // wait for the mouse to move

      if (action !== "hover") {
        // Update timestamp for the actual click action
        if (getDashcamElapsedTime) {
          const elapsed = getDashcamElapsedTime();
          if (elapsed !== null) {
            elementData.timestamp = elapsed;
          }
        }

        if (action === "click" || action === "left-click") {
          await sandbox.send({ type: "leftClick", x, y, ...elementData });
        } else if (action === "right-click") {
          await sandbox.send({ type: "rightClick", x, y, ...elementData });
        } else if (action === "middle-click") {
          await sandbox.send({ type: "middleClick", x, y, ...elementData });
        } else if (action === "double-click") {
          await sandbox.send({ type: "doubleClick", x, y, ...elementData });
        } else if (action === "mouseDown") {
          await sandbox.send({ type: "mousePress", button: "left", x, y, ...elementData });
        } else if (action === "mouseUp") {
          await sandbox.send({
            type: "mouseRelease",
            button: "left",
            x,
            y,
            ...elementData
          });
        }

        emitter.emit(events.mouseClick, { x, y, button, click, double });
        
        // Track interaction
        const sessionId = sessionInstance?.get();
        if (sessionId && elementData.prompt) {
          try {
            const clickDuration = Date.now() - clickStartTime;
            await sandbox.send({
              type: "trackInteraction",
              interactionType: "click",
              session: sessionId,
              prompt: elementData.prompt,
              input: { x, y, action },
              timestamp: clickStartTime,
              duration: clickDuration,
              success: true,
              cacheHit: elementData.cacheHit,
              selector: elementData.selector,
              selectorUsed: elementData.selectorUsed,
            });
          } catch (err) {
            console.warn("Failed to track click interaction:", err.message);
          }
        }
      }

      await redraw.wait(5000, redrawOptions);

      return;
    } catch (error) {
      // Track interaction failure
      const sessionId = sessionInstance?.get();
      if (sessionId && elementData.prompt) {
        try {
          const clickDuration = Date.now() - clickStartTime;
          await sandbox.send({
            type: "trackInteraction",
            interactionType: "click",
            session: sessionId,
            prompt: elementData.prompt,
            input: { x, y, action },
            timestamp: clickStartTime,
            duration: clickDuration,
            success: false,
            error: error.message,
            cacheHit: elementData.cacheHit,
            selector: elementData.selector,
            selectorUsed: elementData.selectorUsed,
          });
        } catch (err) {
          console.warn("Failed to track click interaction:", err.message);
        }
      }
      throw error;
    }
  };

  /**
   * Hover at coordinates
   * @param {Object|number} options - Options object or x coordinate (for backward compatibility)
   * @param {number} options.x - X coordinate
   * @param {number} options.y - Y coordinate
   * @param {string} [options.prompt] - Prompt for tracking
   * @param {boolean} [options.cacheHit] - Whether cache was hit
   * @param {string} [options.selector] - Selector used
   * @param {boolean} [options.selectorUsed] - Whether selector was used
   */
  const hover = async (...args) => {
    const hoverStartTime = Date.now();
    let x, y, elementData, redrawOptions;
    
    // Handle both object and positional argument styles
    if (isObjectArgs(args, ['x', 'y', 'prompt', 'cacheHit', 'selector'])) {
      const { x: xPos, y: yPos, redraw: redrawOpts, ...rest } = args[0];
      x = xPos;
      y = yPos;
      elementData = rest;
      redrawOptions = extractRedrawOptions({ redraw: redrawOpts, ...rest });
    } else {
      // Legacy positional: hover(x, y, elementData)
      [x, y, elementData = {}] = args;
      redrawOptions = extractRedrawOptions(elementData);
    }
    
    try {
      emitter.emit(events.log.narration, theme.dim(`hovering at ${x}, ${y}...`));

      await redraw.start(redrawOptions);

      x = parseInt(x);
      y = parseInt(y);

      // Add dashcam timestamp if available
      if (getDashcamElapsedTime) {
        const elapsed = getDashcamElapsedTime();
        if (elapsed !== null) {
          elementData.timestamp = elapsed;
        }
      }

      await sandbox.send({ type: "moveMouse", x, y, ...elementData });

      // Track interaction
      const sessionId = sessionInstance?.get();
      if (sessionId && elementData.prompt) {
        try {
          const hoverDuration = Date.now() - hoverStartTime;
          await sandbox.send({
            type: "trackInteraction",
            interactionType: "hover",
            session: sessionId,
            prompt: elementData.prompt,
            input: { x, y },
            timestamp: hoverStartTime,
            duration: hoverDuration,
            success: true,
            cacheHit: elementData.cacheHit,
            selector: elementData.selector,
            selectorUsed: elementData.selectorUsed,
          });
        } catch (err) {
          console.warn("Failed to track hover interaction:", err.message);
        }
      }

      await redraw.wait(2500, redrawOptions);

      return;
    } catch (error) {
      // Track interaction failure
      const sessionId = sessionInstance?.get();
      if (sessionId && elementData.prompt) {
        try {
          const hoverDuration = Date.now() - hoverStartTime;
          await sandbox.send({
            type: "trackInteraction",
            interactionType: "hover",
            session: sessionId,
            prompt: elementData.prompt,
            input: { x, y },
            timestamp: hoverStartTime,
            duration: hoverDuration,
            success: false,
            error: error.message,
            cacheHit: elementData.cacheHit,
            selector: elementData.selector,
            selectorUsed: elementData.selectorUsed,
          });
        } catch (err) {
          console.warn("Failed to track hover interaction:", err.message);
        }
      }
      throw error;
    }
  };

  let commands = {
    scroll: scroll,
    click: click,
    hover: hover,
    /**
     * Hover over text on screen
     * @param {Object|string} options - Options object or text (for backward compatibility)
     * @param {string} options.text - Text to find and hover over
     * @param {string|null} [options.description] - Optional description of the element
     * @param {string} [options.action='click'] - Action to perform
     * @param {number} [options.timeout=5000] - Timeout in milliseconds
     */
    "hover-text": async (...args) => {
      let text, description, action, timeout;
      
      // Handle both object and positional argument styles
      if (isObjectArgs(args, ['text', 'description', 'action', 'timeout'])) {
        ({ text, description = null, action = 'click', timeout = 5000 } = args[0]);
      } else {
        // Legacy positional: hoverText(text, description, action, timeout)
        [text, description = null, action = 'click', timeout = 5000] = args;
      }
      
      emitter.emit(
        events.log.narration,
        theme.dim(
          `searching for "${text}"${description ? ` (${description})` : ""}...`,
        ),
      );

      text = text ? text.toString() : null;

      // wait for the text to appear on screen
      await commands["wait-for-text"]({ text, timeout });

      description = description ? description.toString() : null;

      emitter.emit(events.log.narration, theme.dim("thinking..."), true);

      // Combine text and description into element parameter
      let element = text;
      if (description) {
        element = `"${text}" with description ${description}`;
      }

      let response = await sdk.req("find", {
        element,
        image: await system.captureScreenBase64(),
      });

      if (!response || !response.coordinates) {
        throw new MatchError("No text on screen matches description");
      }

      // Perform the action using the located coordinates
      if (action === "hover") {
        await commands.hover({ x: response.coordinates.x, y: response.coordinates.y });
      } else {
        await click({ x: response.coordinates.x, y: response.coordinates.y, action });
      }

      return response;
    },
    /**
     * Hover over an image on screen
     * @param {Object|string} options - Options object or description (for backward compatibility)
     * @param {string} options.description - Description of the image to find
     * @param {string} [options.action='click'] - Action to perform
     */
    "hover-image": async (...args) => {
      let description, action;
      
      // Handle both object and positional argument styles
      if (isObjectArgs(args, ['description', 'action'])) {
        ({ description, action = 'click' } = args[0]);
      } else {
        // Legacy positional: hoverImage(description, action)
        [description, action = 'click'] = args;
      }
      
      emitter.emit(
        events.log.narration,
        theme.dim(`searching for image: "${description}"...`),
      );

      let response = await sdk.req("find", {
        element: description,
        image: await system.captureScreenBase64(),
      });

      if (!response || !response.coordinates) {
        throw new MatchError("No image or icon on screen matches description");
      }

      // Perform the action using the located coordinates
      if (action === "hover") {
        await commands.hover({ x: response.coordinates.x, y: response.coordinates.y });
      } else {
        await click({ x: response.coordinates.x, y: response.coordinates.y, action });
      }

      return response;
    },
    /**
     * Match and interact with an image template
     * @param {Object|string} options - Options object or path (for backward compatibility)
     * @param {string} options.path - Path to the image template
     * @param {string} [options.action='click'] - Action to perform
     * @param {boolean} [options.invert=false] - Invert the match
     */
    "match-image": async (...args) => {
      let relativePath, action, invert;
      
      // Handle both object and positional argument styles
      if (isObjectArgs(args, ['path', 'action', 'invert'])) {
        ({ path: relativePath, action = 'click', invert = false } = args[0]);
      } else {
        // Legacy positional: matchImage(relativePath, action, invert)
        [relativePath, action = 'click', invert = false] = args;
      }
      
      emitter.emit(
        events.log.narration,
        theme.dim(`${action} on image template "${relativePath}"...`),
      );

      // Resolve the image path relative to the current file
      const resolvedPath = resolveRelativePath(relativePath);

      let image = await system.captureScreenPNG();

      let result = await findImageOnScreen(resolvedPath, image);

      if (invert) {
        result = !result;
      }

      if (!result) {
        throw new CommandError(`Image not found: ${resolvedPath}`);
      } else {
        if (action === "click") {
          await click({ x: result.centerX, y: result.centerY, action });
        } else if (action === "hover") {
          await hover({ x: result.centerX, y: result.centerY });
        }
      }

      return true;
    },
    /**
     * Type text
     * @param {string|number} text - Text to type
     * @param {Object} [options] - Additional options
     * @param {number} [options.delay=250] - Delay between keystrokes in milliseconds
     * @param {boolean} [options.secret=false] - If true, text is treated as sensitive (not logged or stored)
     * @param {Object} [options.redraw] - Redraw detection options
     * @param {boolean} [options.redraw.enabled=true] - Enable/disable redraw detection
     * @param {boolean} [options.redraw.screenRedraw=true] - Enable/disable screen redraw detection
     * @param {boolean} [options.redraw.networkMonitor=true] - Enable/disable network monitoring
     * @param {number} [options.redraw.diffThreshold=0.1] - Screen diff threshold percentage
     */
    "type": async (text, options = {}) => {
      const typeStartTime = Date.now();
      const { delay = 250, secret = false, redraw: redrawOpts, ...elementData } = options;
      const redrawOptions = extractRedrawOptions({ redraw: redrawOpts, ...options });
      
      // Log masked version if secret, otherwise show actual text
      if (secret) {
        emitter.emit(events.log.narration, theme.dim(`typing secret "****"...`));
      } else {
        emitter.emit(events.log.narration, theme.dim(`typing "${text}"...`));
      }

      await redraw.start(redrawOptions);

      text = text.toString();

      // Add dashcam timestamp if available
      if (getDashcamElapsedTime) {
        const elapsed = getDashcamElapsedTime();
        if (elapsed !== null) {
          elementData.timestamp = elapsed;
        }
      }

      // Actually type the text in the sandbox
      await sandbox.send({ type: "write", text, delay, ...elementData });
      
      // Track interaction
      const sessionId = sessionInstance?.get();
      if (sessionId) {
        try {
          const typeDuration = Date.now() - typeStartTime;
          await sandbox.send({
            type: "trackInteraction",
            interactionType: "type",
            session: sessionId,
            // Store masked text if secret, otherwise store actual text
            input: { text: secret ? "****" : text, delay },
            timestamp: typeStartTime,
            duration: typeDuration,
            success: true,
            isSecret: secret, // Flag this interaction if it contains a secret
          });
        } catch (err) {
          console.warn("Failed to track type interaction:", err.message);
        }
      }
      
      await redraw.wait(5000, redrawOptions);
      return;
    },
    /**
     * Press keyboard keys
     * @param {Array} keys - Array of keys to press
     * @param {Object} [options] - Additional options
     * @param {Object} [options.redraw] - Redraw detection options
     * @param {boolean} [options.redraw.enabled=true] - Enable/disable redraw detection
     * @param {boolean} [options.redraw.screenRedraw=true] - Enable/disable screen redraw detection
     * @param {boolean} [options.redraw.networkMonitor=true] - Enable/disable network monitoring
     * @param {number} [options.redraw.diffThreshold=0.1] - Screen diff threshold percentage
     */
    "press-keys": async (keys, options = {}) => {
      const pressKeysStartTime = Date.now();
      const redrawOptions = extractRedrawOptions(options);
      emitter.emit(
        events.log.narration,
        theme.dim(
          `pressing keys: ${Array.isArray(keys) ? keys.join(", ") : keys}...`,
        ),
      );

      await redraw.start(redrawOptions);

      // finally, press the keys
      await sandbox.send({ type: "press", keys });
      
      // Track interaction
      const sessionId = sessionInstance?.get();
      if (sessionId) {
        try {
          const pressKeysDuration = Date.now() - pressKeysStartTime;
          await sandbox.send({
            type: "trackInteraction",
            interactionType: "pressKeys",
            session: sessionId,
            input: { keys },
            timestamp: pressKeysStartTime,
            duration: pressKeysDuration,
            success: true,
          });
        } catch (err) {
          console.warn("Failed to track pressKeys interaction:", err.message);
        }
      }

      await redraw.wait(5000, redrawOptions);

      return;
    },
    /**
     * Wait for specified time
     * @param {number} [timeout=3000] - Time to wait in milliseconds
     * @param {Object} [options] - Additional options (reserved for future use)
     */
    "wait": async (timeout = 3000, options = {}) => {
      const waitStartTime = Date.now();
      emitter.emit(events.log.narration, theme.dim(`waiting ${timeout}ms...`));
      const result = await delay(timeout);
      
      // Track interaction
      const sessionId = sessionInstance?.get();
      if (sessionId) {
        try {
          const waitDuration = Date.now() - waitStartTime;
          await sandbox.send({
            type: "trackInteraction",
            interactionType: "wait",
            session: sessionId,
            input: { timeout },
            timestamp: waitStartTime,
            duration: waitDuration,
            success: true,
          });
        } catch (err) {
          console.warn("Failed to track wait interaction:", err.message);
        }
      }
      
      return result;
    },
    /**
     * Wait for image to appear on screen
     * @param {Object|string} options - Options object or description (for backward compatibility)
     * @param {string} options.description - Description of the image
     * @param {number} [options.timeout=10000] - Timeout in milliseconds
     */
    "wait-for-image": async (...args) => {
      let description, timeout;
      
      // Handle both object and positional argument styles
      if (isObjectArgs(args, ['description', 'timeout'])) {
        ({ description, timeout = 10000 } = args[0]);
      } else {
        // Legacy positional: waitForImage(description, timeout)
        [description, timeout = 10000] = args;
      }
      
      emitter.emit(
        events.log.narration,
        theme.dim(
          `waiting for an image matching description "${description}"...`,
        ),
        true,
      );

      let startTime = new Date().getTime();
      let durationPassed = 0;
      let passed = false;

      while (durationPassed < timeout && !passed) {
        passed = await assert(
          `An image matching the description "${description}" appears on screen.`,
          false,
        );

        durationPassed = new Date().getTime() - startTime;
        if (!passed) {
          emitter.emit(
            events.log.narration,
            theme.dim(
              `${niceSeconds(durationPassed)} seconds have passed without finding an image matching the description "${description}"`,
            ),
            true,
          );
          await delay(2500);
        }
      }

      if (passed) {
        emitter.emit(
          events.log.narration,
          theme.dim(
            `An image matching the description "${description}" found!`,
          ),
          true,
        );
        
        // Track interaction success
        const sessionId = sessionInstance?.get();
        if (sessionId) {
          try {
            const waitForImageDuration = Date.now() - startTime;
            await sandbox.send({
              type: "trackInteraction",
              interactionType: "waitForImage",
              session: sessionId,
              prompt: description,
              input: { timeout },
              timestamp: startTime,
              duration: waitForImageDuration,
              success: true,
            });
          } catch (err) {
            console.warn("Failed to track waitForImage interaction:", err.message);
          }
        }
        
        return;
      } else {
        // Track interaction failure
        const sessionId = sessionInstance?.get();
        const errorMsg = `Timed out (${niceSeconds(timeout)} seconds) while searching for an image matching the description "${description}"`;
        if (sessionId) {
          try {
            const waitForImageDuration = Date.now() - startTime;
            await sandbox.send({
              type: "trackInteraction",
              interactionType: "waitForImage",
              session: sessionId,
              prompt: description,
              input: { timeout },
              timestamp: startTime,
              duration: waitForImageDuration,
              success: false,
              error: errorMsg,
            });
          } catch (err) {
            console.warn("Failed to track waitForImage interaction:", err.message);
          }
        }
        
        throw new MatchError(errorMsg);
      }
    },
    /**
     * Wait for text to appear on screen
     * @param {Object|string} options - Options object or text (for backward compatibility)
     * @param {string} options.text - Text to wait for
     * @param {number} [options.timeout=5000] - Timeout in milliseconds
     * @param {Object} [options.redraw] - Redraw detection options
     * @param {boolean} [options.redraw.enabled=true] - Enable/disable redraw detection
     * @param {boolean} [options.redraw.screenRedraw=true] - Enable/disable screen redraw detection
     * @param {boolean} [options.redraw.networkMonitor=true] - Enable/disable network monitoring
     * @param {number} [options.redraw.diffThreshold=0.1] - Screen diff threshold percentage
     */
    "wait-for-text": async (...args) => {
      let text, timeout, redrawOptions;
      
      // Handle both object and positional argument styles
      if (isObjectArgs(args, ['text', 'timeout'])) {
        const { redraw: redrawOpts, ...rest } = args[0];
        ({ text, timeout = 5000 } = rest);
        redrawOptions = extractRedrawOptions({ redraw: redrawOpts, ...rest });
      } else {
        // Legacy positional: waitForText(text, timeout)
        [text, timeout = 5000] = args;
        redrawOptions = {};
      }
      
      await redraw.start(redrawOptions);

      emitter.emit(
        events.log.narration,
        theme.dim(`waiting for text: "${text}"...`),
        true,
      );

      let startTime = new Date().getTime();
      let durationPassed = 0;

      let passed = false;

      while (durationPassed < timeout && !passed) {
        const response = await sdk.req("find", {
          element: text,
          image: await system.captureScreenBase64(),
        });

        passed = !!(response && response.coordinates);

        durationPassed = new Date().getTime() - startTime;

        if (!passed) {
          emitter.emit(
            events.log.narration,
            theme.dim(
              `${niceSeconds(durationPassed)} seconds have passed without finding "${text}"`,
            ),
            true,
          );
          await delay(2500);
        }
      }

      if (passed) {
        emitter.emit(events.log.narration, theme.dim(`"${text}" found!`), true);
        
        // Track interaction success
        const sessionId = sessionInstance?.get();
        if (sessionId) {
          try {
            const waitForTextDuration = Date.now() - startTime;
            await sandbox.send({
              type: "trackInteraction",
              interactionType: "waitForText",
              session: sessionId,
              prompt: text,
              input: { timeout },
              timestamp: startTime,
              duration: waitForTextDuration,
              success: true,
            });
          } catch (err) {
            console.warn("Failed to track waitForText interaction:", err.message);
          }
        }
        
        return;
      } else {
        // Track interaction failure
        const sessionId = sessionInstance?.get();
        const errorMsg = `Timed out (${niceSeconds(timeout)} seconds) while searching for "${text}"`;
        if (sessionId) {
          try {
            const waitForTextDuration = Date.now() - startTime;
            await sandbox.send({
              type: "trackInteraction",
              interactionType: "waitForText",
              session: sessionId,
              prompt: text,
              input: { timeout },
              timestamp: startTime,
              duration: waitForTextDuration,
              success: false,
              error: errorMsg,
            });
          } catch (err) {
            console.warn("Failed to track waitForText interaction:", err.message);
          }
        }
        
        throw new MatchError(errorMsg);
      }
    },
    /**
     * Scroll until text is found
     * @param {Object|string} options - Options object or text (for backward compatibility)
     * @param {string} options.text - Text to find
     * @param {string} [options.direction='down'] - Scroll direction
     * @param {number} [options.maxDistance=10000] - Maximum distance to scroll in pixels
     * @param {boolean} [options.invert=false] - Invert the match
     * @param {Object} [options.redraw] - Redraw detection options
     * @param {boolean} [options.redraw.enabled=true] - Enable/disable redraw detection
     * @param {boolean} [options.redraw.screenRedraw=true] - Enable/disable screen redraw detection
     * @param {boolean} [options.redraw.networkMonitor=true] - Enable/disable network monitoring
     * @param {number} [options.redraw.diffThreshold=0.1] - Screen diff threshold percentage
     */
    "scroll-until-text": async (...args) => {
      let text, direction, maxDistance, invert, redrawOptions;
      
      // Handle both object and positional argument styles
      if (isObjectArgs(args, ['text', 'direction', 'maxDistance', 'invert'])) {
        const { redraw: redrawOpts, ...rest } = args[0];
        ({ text, direction = 'down', maxDistance = 10000, invert = false } = rest);
        redrawOptions = extractRedrawOptions({ redraw: redrawOpts, ...rest });
      } else {
        // Legacy positional: scrollUntilText(text, direction, maxDistance, invert)
        [text, direction = 'down', maxDistance = 10000, invert = false] = args;
        redrawOptions = {};
      }
      
      await redraw.start(redrawOptions);

      emitter.emit(
        events.log.narration,
        theme.dim(`scrolling for text: "${text}"...`),
        true,
      );

      let scrollDistance = 0;
      let incrementDistance = 500;
      let passed = false;

      while (scrollDistance <= maxDistance && !passed) {
        const response = await sdk.req("find", {
          element: text,
          image: await system.captureScreenBase64(),
        });

        passed = !!(response && response.coordinates);

        if (invert) {
          passed = !passed;
        }

        if (!passed) {
          emitter.emit(
            events.log.narration,
            theme.dim(
              `scrolling ${direction} ${incrementDistance}px. ${scrollDistance + incrementDistance}/${maxDistance}px scrolled...`,
            ),
            true,
          );
          await scroll(direction, { amount: incrementDistance });
          scrollDistance = scrollDistance + incrementDistance;
        }
      }

      if (passed) {
        emitter.emit(events.log.narration, theme.dim(`"${text}" found!`), true);
        return;
      } else {
        throw new MatchError(
          `Scrolled ${scrollDistance} pixels without finding "${text}"`,
        );
      }
    },
    /**
     * Scroll until image is found
     * @param {Object|string} options - Options object or description (for backward compatibility)
     * @param {string} [options.description] - Description of the image
     * @param {string} [options.direction='down'] - Scroll direction
     * @param {number} [options.maxDistance=10000] - Maximum distance to scroll in pixels
     * @param {string} [options.method='mouse'] - Scroll method
     * @param {string} [options.path] - Path to image template
     * @param {boolean} [options.invert=false] - Invert the match
     */
    "scroll-until-image": async (...args) => {
      let description, direction, maxDistance, method, imagePath, invert;
      
      // Handle both object and positional argument styles
      if (isObjectArgs(args, ['description', 'direction', 'maxDistance', 'method', 'path', 'invert'])) {
        ({ description, direction = 'down', maxDistance = 10000, method = 'mouse', path: imagePath, invert = false } = args[0]);
      } else {
        // Legacy positional: scrollUntilImage(description, direction, maxDistance, method, path, invert)
        [description, direction = 'down', maxDistance = 10000, method = 'mouse', imagePath, invert = false] = args;
      }
      
      const needle = description || imagePath;

      if (!needle) {
        throw new CommandError("No description or path provided");
      }

      if (description && imagePath) {
        throw new CommandError(
          "Only one of description or path can be provided",
        );
      }

      emitter.emit(
        events.log.narration,
        theme.dim(`scrolling for an image matching "${needle}"...`),
        true,
      );

      let scrollDistance = 0;
      let incrementDistance = 500;
      let passed = false;

      while (scrollDistance <= maxDistance && !passed) {
        if (description) {
          passed = await assert(
            `An image matching the description "${description}" appears on screen.`,
            false,
            false,
            invert,
          );
        }

        if (imagePath) {
          // Don't throw if not found. We only want to know if it's found or not.
          passed = await commands["match-image"]({ path: imagePath }).catch(
            console.warn,
          );
        }

        if (!passed) {
          emitter.emit(
            events.log.narration,
            theme.dim(`scrolling ${direction} ${incrementDistance} pixels...`),
            true,
          );
          await scroll(direction, { amount: incrementDistance });
          scrollDistance = scrollDistance + incrementDistance;
        }
      }

      if (passed) {
        emitter.emit(
          events.log.narration,
          theme.dim(`"${needle}" found!`),
          true,
        );
        return;
      } else {
        throw new CommandError(
          `Scrolled ${scrollDistance} pixels without finding an image matching "${needle}"`,
        );
      }
    },
    /**
     * Focus an application by name
     * @param {string} name - Application name
     * @param {Object} [options] - Additional options
     * @param {Object} [options.redraw] - Redraw detection options
     * @param {boolean} [options.redraw.enabled=true] - Enable/disable redraw detection
     * @param {boolean} [options.redraw.screenRedraw=true] - Enable/disable screen redraw detection
     * @param {boolean} [options.redraw.networkMonitor=true] - Enable/disable network monitoring
     * @param {number} [options.redraw.diffThreshold=0.1] - Screen diff threshold percentage
     */
    "focus-application": async (name, options = {}) => {
      const redrawOptions = extractRedrawOptions(options);
      await redraw.start(redrawOptions);

      await sandbox.send({
        type: "commands.focus-application",
        name,
      });
      await redraw.wait(1000, redrawOptions);
      return "The application was focused.";
    },
    /**
     * Extract information from the screen using AI
     * @param {Object|string} options - Options object or description (for backward compatibility)
     * @param {string} options.description - What to extract
     */
    "extract": async (...args) => {
      const rememberStartTime = Date.now();
      let description;
      
      // Handle both object and positional argument styles
      if (isObjectArgs(args, ['description'])) {
        ({ description } = args[0]);
      } else {
        // Legacy positional: remember(description)
        [description] = args;
      }
      
      try {
        let result = await sdk.req("remember", {
          image: await system.captureScreenBase64(),
          description,
        });
        
        // Track interaction success
        const sessionId = sessionInstance?.get();
        if (sessionId) {
          try {
            const rememberDuration = Date.now() - rememberStartTime;
            await sandbox.send({
              type: "trackInteraction",
              interactionType: "remember",
              session: sessionId,
              prompt: description,
              timestamp: rememberStartTime,
              duration: rememberDuration,
              success: true,
            });
          } catch (err) {
            console.warn("Failed to track remember interaction:", err.message);
          }
        }
        
        return result.data;
      } catch (error) {
        // Track interaction failure
        const sessionId = sessionInstance?.get();
        if (sessionId) {
          try {
            const rememberDuration = Date.now() - rememberStartTime;
            await sandbox.send({
              type: "trackInteraction",
              interactionType: "remember",
              session: sessionId,
              prompt: description,
              timestamp: rememberStartTime,
              duration: rememberDuration,
              success: false,
              error: error.message,
            });
          } catch (err) {
            console.warn("Failed to track remember interaction:", err.message);
          }
        }
        throw error;
      }
    },
    /**
     * Make an AI-powered assertion
     * @param {string} assertion - Assertion to check
     * @param {Object} [options] - Additional options (reserved for future use)
     */
    "assert": async (assertion, options = {}) => {
      let response = await assert(assertion, true);

      return response;
    },
    /**
     * Execute code in the sandbox
     * @param {Object|string} options - Options object or language (for backward compatibility)
     * @param {string} [options.language='pwsh'] - Language ('js', 'pwsh', or 'sh')
     * @param {string} options.code - Code to execute
     * @param {number} [options.timeout] - Timeout in milliseconds
     * @param {boolean} [options.silent=false] - Suppress output
     */
    "exec": async (...args) => {
      let language, code, timeout, silent;
      
      // Handle both object and positional argument styles
      if (isObjectArgs(args, ['language', 'code', 'timeout', 'silent'])) {
        ({ language = 'pwsh', code, timeout, silent = false } = args[0]);
      } else {
        // Legacy positional: exec(language, code, timeout, silent)
        [language = 'pwsh', code, timeout, silent = false] = args;
      }
      
      emitter.emit(events.log.narration, theme.dim(`calling exec...`), true);

      emitter.emit(events.log.log, code);

      let plat = system.platform();

      if (language == "pwsh" || language == "sh") {
        if (language === "pwsh" && sandbox.os === "linux") {
          emitter.emit(
            events.log.log,
            theme.yellow(
              `⚠️  Warning: You are using 'pwsh' exec command on a Linux sandbox. This may fail. Consider using 'bash' or 'sh' for Linux environments.`,
            ),
            true,
          );
        }

        if (language === "sh" && sandbox.os === "windows") {
          emitter.emit(
            events.log.log,
            theme.yellow(
              `⚠️  Warning: You are using 'sh' exec command on a Windows sandbox. This will fail. Automatically switching to 'pwsh' for Windows environments.`,
            ),
            true,
          );
          // Automatically switch to pwsh for Windows
          language = "pwsh";
        }

        let result = null;

        result = await sandbox.send({
          type: "commands.run",
          command: code,
          timeout,
        });

        if (result.out && result.out.returncode !== 0) {
          throw new MatchError(
            `Command failed with exit code ${result.out.returncode}: ${result.out.stderr}`,
          );
        } else {
          if (!silent && result.out?.stdout) {
            emitter.emit(events.log.log, theme.dim(`stdout:`), true);
            emitter.emit(events.log.log, `${result.out.stdout}`, true);
          }

          if (!silent && result.out.stderr) {
            emitter.emit(events.log.log, theme.dim(`stderr:`), true);
            emitter.emit(events.log.log, `${result.out.stderr}`, true);
          }

          return result.out?.stdout?.trim();
        }
      } else if (language == "js") {
        emitter.emit(events.log.narration, theme.dim(`running js...`), true);

        emitter.emit(
          events.log.narration,
          theme.dim(`running value of \`${plat}\` in local JS vm...`),
          true,
        );

        emitter.emit(events.log.log, "");
        emitter.emit(events.log.log, "------");

        const context = vm.createContext({
          require,
          console,
          fs,
          process,
          fetch,
        });

        let scriptCode = "(async function() {\n" + code + "\n})();";

        const script = new vm.Script(scriptCode);

        try {
          await script.runInNewContext(context);
        } catch (e) {
          // Log the error to the emitter instead of console.error to maintain consistency
          emitter.emit(
            events.log.debug,
            `JavaScript execution error: ${e.message}`,
          );
          // Wait a tick to allow any promise rejections to be handled
          throw new CommandError(`Error running script: ${e.message}`);
        }

        // wait for context.result to resolve
        let stepResult = await context.result;

        // conver it to string
        if (typeof stepResult === "object") {
          stepResult = JSON.stringify(stepResult, null, 2);
        } else if (typeof stepResult === "function") {
          stepResult = stepResult.toString();
        }

        emitter.emit(events.log.log, "------");
        emitter.emit(events.log.log, "");

        if (!stepResult) {
          emitter.emit(events.log.log, `No result returned from script`, true);
        } else {
          if (!silent) {
            emitter.emit(events.log.log, theme.dim(`Result:`), true);
            emitter.emit(events.log.log, stepResult, true);
          }
        }

        return stepResult;
        // }
      } else {
        throw new CommandError(`Language not supported: ${language}`);
      }
    },
  };

  // Return the commands, assert function, and redraw instance
  return { commands, assert, redraw };
};

// Export the factory function
module.exports = { createCommands };
