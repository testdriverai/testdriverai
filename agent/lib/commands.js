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

// Factory function that creates commands with the provided emitter
const createCommands = (
  emitter,
  system,
  sandbox,
  config,
  sessionInstance,
  getCurrentFilePath,
  redrawThreshold = 0.1,
) => {
  // Create SDK instance with emitter, config, and session
  const sdk = createSDK(emitter, config, sessionInstance);
  // Create redraw instance with the system
  const redraw = createRedraw(emitter, system, sandbox, redrawThreshold);

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

    emitter.emit(events.log.narration, `thinking...`);

    let response = await sdk.req("assert", {
      expect: assertion,
      image: await system.captureScreenBase64(),
    });
    return handleAssertResponse(response.data);
  };
  const scroll = async (direction = "down", amount = 300) => {

    emitter.emit(
      events.log.narration,
      theme.dim(`scrolling ${direction} ${amount}px...`),
    );

    await redraw.start();

    amount = parseInt(amount, 10);

    const before = await system.captureScreenBase64();
    switch (direction) {
      case "up":
        await sandbox.send({
          type: "scroll",
          amount,
          direction,
        });
        await redraw.wait(2500);
        break;
      case "down":
        await sandbox.send({
          type: "scroll",
          amount,
          direction,
        });
        await redraw.wait(2500);
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

  // perform a mouse click
  // click, right-click, double-click, hover
  const click = async (x, y, action = "click") => {
    await redraw.start();

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

    await sandbox.send({ type: "moveMouse", x, y });

    emitter.emit(events.mouseMove, { x, y });

    await delay(2500); // wait for the mouse to move

    if (action !== "hover") {
      if (action === "click" || action === "left-click") {
        await sandbox.send({ type: "leftClick" });
      } else if (action === "right-click") {
        await sandbox.send({ type: "rightClick" });
      } else if (action === "middle-click") {
        await sandbox.send({ type: "middleClick" });
      } else if (action === "double-click") {
        await sandbox.send({ type: "doubleClick" });
      } else if (action === "mouseDown") {
        await sandbox.send({ type: "mousePress", button: "left" });
      } else if (action === "mouseUp") {
        await sandbox.send({
          
          type: "mouseRelease",
          button: "left",
        });
      }

      emitter.emit(events.mouseClick, { x, y, button, click, double });
    }

    await redraw.wait(5000);

    return;
  };

  const hover = async (x, y) => {
    emitter.emit(
      events.log.narration,
      theme.dim(`hovering at ${x}, ${y}...`),
    );

    await redraw.start();

    x = parseInt(x);
    y = parseInt(y);

    await sandbox.send({ type: "moveMouse", x, y });

    await redraw.wait(2500);

    return;
  };

  let commands = {
    scroll: scroll,
    click: click,
    hover: hover,
    // method, levenshein, dice, or combined
    // leven = this is turbo, all around good for text similarity
    // dice = this is good for short strings, but not as good for long strings
    // turbo (default) = turbo of both, with a 2x preference for levenshtein
    "hover-text": async (
      text,
      description = null,
      action = "click",
      timeout = 5000, // we pass this to the subsequent wait-for-text block
    ) => {
      emitter.emit(
        events.log.narration,
        theme.dim(`searching for "${text}"${description ? ` (${description})` : ""}...`),
      );

      text = text ? text.toString() : null;

      // wait for the text to appear on screen
      await commands["wait-for-text"](text, timeout);

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
        await commands.hover(response.coordinates.x, response.coordinates.y);
      } else {
        await click(response.coordinates.x, response.coordinates.y, action);
      }

      return response;
    },
    // uses our api to find all images on screen
    "hover-image": async (description, action = "click") => {
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
        await commands.hover(response.coordinates.x, response.coordinates.y);
      } else {
        await click(response.coordinates.x, response.coordinates.y, action);
      }

      return response;
    },
    "match-image": async (relativePath, action = "click", invert = false) => {
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
          await click(result.centerX, result.centerY, action);
        } else if (action === "hover") {
          await hover(result.centerX, result.centerY);
        }
      }

      return true;
    },
    // type a string
    
    type: async (string, delay = 250) => {
      emitter.emit(
        events.log.narration,
        theme.dim(`typing "${string}"...`),
      );

      await redraw.start();

      string = string.toString();

      await sandbox.send({ type: "write", text: string, delay });
      await redraw.wait(5000);
      return;
    },
    // press keys
    // different than `type`, becasue it can press multiple keys at once
    "press-keys": async (inputKeys) => {
      emitter.emit(
        events.log.narration,
        theme.dim(`pressing keys: ${Array.isArray(inputKeys) ? inputKeys.join(", ") : inputKeys}...`),
      );

      await redraw.start();

      // finally, press the keys
      await sandbox.send({ type: "press", keys: inputKeys });

      await redraw.wait(5000);

      return;
    },
    // simple delay, usually to let ui render or webpage to load
    wait: async (timeout = 3000) => {
      emitter.emit(
        events.log.narration,
        theme.dim(`waiting ${timeout}ms...`),
      );
      return await delay(timeout);
    },
    "wait-for-image": async (description, timeout = 10000) => {
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
        return;
      } else {
        throw new MatchError(
          `Timed out (${niceSeconds(timeout)} seconds) while searching for an image matching the description "${description}"`,
        );
      }
    },
    "wait-for-text": async (text, timeout = 5000) => {
      await redraw.start();

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
        return;
      } else {
        throw new MatchError(
          `Timed out (${niceSeconds(timeout)} seconds) while searching for "${text}"`,
        );
      }
    },
    "scroll-until-text": async (
      text,
      direction = "down",
      maxDistance = 10000,
      invert = false,
    ) => {
      await redraw.start();

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
          await scroll(direction, incrementDistance);
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
    "scroll-until-image": async (
      description,
      direction = "down",
      maxDistance = 10000,
      method = "mouse",
      path,
      invert = false,
    ) => {
      const needle = description || path;

      if (!needle) {
        throw new CommandError("No description or path provided");
      }

      if (description && path) {
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

        if (path) {
          // Don't throw if not found. We only want to know if it's found or not.
          passed = await commands["match-image"](path, null).catch(
            console.warn,
          );
        }

        if (!passed) {
          emitter.emit(
            events.log.narration,
            theme.dim(`scrolling ${direction} ${incrementDistance} pixels...`),
            true,
          );
          await scroll(direction, incrementDistance, method);
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
    // run applescript to focus an application by name
    "focus-application": async (name) => {
      await redraw.start();

      await sandbox.send({
        
        type: "commands.focus-application",
        name,
      });
      await redraw.wait(1000);
      return "The application was focused.";
    },
    remember: async (description) => {
      let result = await sdk.req("remember", {
        image: await system.captureScreenBase64(),
        description,
      });
      return result.data;
    },
    assert: async (assertion) => {
      let response = await assert(assertion, true);

      return response;
    },
    exec: async (language = "pwsh", code, timeout, silent = false) => {
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
