// the actual commands to interact with the system
const sdk = require("./sdk");
const chalk = require("chalk");
const {
  captureScreenBase64,
  captureScreenPNG,
  platform,
  activeWin,
} = require("./system");
const { log } = require("./logger");
const keymap = require("./keymap");
const { focusApplication } = require("./focus-application");
const fs = require("fs").promises; // Using the promises version for async operations
const robot = require("robotjs");
const { findTemplateImage } = require("./subimage/index");
const { cwd } = require("node:process");
const path = require("path");
const Jimp = require("jimp");
const os = require("os");
const cliProgress = require("cli-progress");
const redraw = require("./redraw");
const logger = require("./logger");
const { emitter, events } = require("./events.js");

const niceSeconds = (ms) => {
  return Math.round(ms / 1000);
};
const delay = (t) => new Promise((resolve) => setTimeout(resolve, t));
class AiError extends Error {
  constructor(message, fatal = false, attatchScreenshot = true) {
    super(message);
    this.fatal = fatal;
    this.attachScreenshot = attatchScreenshot;
  }
}

const commandOrControl = process.platform === "darwin" ? "command" : "control";

const findImageOnScreen = async (relativePath, haystack, restrictToWindow) => {
  // move the file from filePath to `testdriver/screenshots`
  let rootpath = path.join(cwd(), `testdriver`, `screenshots`, platform());
  // add .png to relative path if not already there
  if (!relativePath.endsWith(".png")) {
    relativePath = relativePath + ".png";
  }

  let needle = path.join(rootpath, relativePath);

  // check if the file exists
  if (await !fs.access(needle)) {
    throw new AiError(`Image does not exist or do not have access: ${needle}`);
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
        let activeWindow = await activeWin();

        // filter out text that is not in the active window
        if (restrictToWindow) {
          results = results.filter((el) => {
            return (
              el.centerX > activeWindow.bounds.x &&
              el.centerX < activeWindow.bounds.x + activeWindow.bounds.width &&
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

const assert = async (assertion, shouldThrow = false, async = false) => {
  if (async) {
    shouldThrow = true;
  }

  const handleAssertResponse = (response) => {
    logger.prettyMarkdown(response);

    if (response.indexOf("The task passed") > -1) {
      return true;
    } else {
      if (shouldThrow) {
        throw new AiError(`AI Assertion failed`, true);
      } else {
        return false;
      }
    }
  };

  // take a screenshot
  log("info", "");
  log("info", chalk.dim("thinking..."), true);
  log("info", "");

  if (async) {
    await sdk
      .req("assert", {
        expect: assertion,
        image: await captureScreenBase64(),
      })
      .then((response) => {
        return handleAssertResponse(response.data);
      });

    return true;
  } else {
    let response = await sdk.req("assert", {
      expect: assertion,
      image: await captureScreenBase64(),
    });
    return handleAssertResponse(response.data);
  }
};
const scroll = async (direction = "down", amount = 300, method = "keyboard") => {
  await redraw.start();

  amount = parseInt(amount);

  if (method === "mouse") {
    // after experimenting, 200 is a good default for mouse, mostly as mouse will be called only when the user asks for it
    // and that happens when keyboard scrolling cannot do things when there's a pop up that needs to be scrolled over and 
    // pop ups are usually smaller and needs a smaller amount of scrolling
    amount = 200;
  }

  switch (direction) {
    case "up":
      if (method === "mouse") {
        await robot.scrollMouse(0, amount );
      } else {
        await robot.keyTap("pageup");
      }
      await redraw.wait(2500);
      break;
    case "down":
      if (method === "mouse") {
        await robot.scrollMouse(0, amount * -1);
      } else {
        await robot.keyTap("pagedown");
      }
      await redraw.wait(2500);
      break;
    case "left":
      await robot.scrollMouse(amount * -1, 0);
      await redraw.wait(2500);
      break;
    case "right":
      await robot.scrollMouse(amount, 0);
      await redraw.wait(2500);
      break;
    default:
      throw new AiError("Direction not found");
  }
};

// perform a mouse click
// click, right-click, double-click, hover
const click = async (x, y, action = "click") => {
  await redraw.start();

  let button = 'left';
  let double = false;

  if (action === "right-click" && process.platform !== "darwin" ) {
    button = "right";
  }
  if (action === "double-click") {
    double = true;
  }

  log("debug", chalk.dim(`${click} ${button} clicking at ${x}, ${y}...`), true);

  x = parseInt(x);
  y = parseInt(y);

  robot.moveMouseSmooth(x, y, 0.1);
  
  await delay(1000); // wait for the mouse to move

  if (process.platform === "darwin" && action === "right-click") {
    robot.keyToggle('control', 'down', 'control');
    await delay(250);
  }

  if (action !== "hover") {
    robot.mouseClick(button, double);
    emitter.emit(events.mouseClick, { x, y, button, click });
  }

  if (process.platform === "darwin" && action === "right-click") {
    await delay(250);
    robot.keyToggle('control', 'up', 'control');
  }

  await redraw.wait(5000);
  return;
};

const hover = async (x, y) => {
  await redraw.start();

  x = parseInt(x);
  y = parseInt(y);

  await robot.moveMouseSmooth(x, y, 0.1);

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
    method = "turbo",
  ) => {
    text = text ? text.toString() : null;
    description = description ? description.toString() : null;

    log("info", "");
    log("info", chalk.dim("thinking..."), true);
    log("info", "");

    const mdStream = logger.createMarkdownStreamLogger();
    let response = await sdk.req(
      "hover/text",
      {
        needle: text,
        method,
        image: await captureScreenBase64(),
        intent: action,
        description,
        displayMultiple: 1,
      },
      (chunk) => {
        if (chunk.type === "data" && chunk.data) {
          mdStream.log(chunk.data);
        } else if (chunk.type === "closeMatches") {
          emitter.emit(events.matches.show, chunk.data);
        }
      },
    );
    mdStream.end();

    if (!response.data) {
      throw new AiError("No text on screen matches description");
    } else {
      return response.data;
    }
  },
  // uses our api to find all images on screen
  "hover-image": async (
    description,
    action = "click",
  ) => {
    // take a screenshot
    log("info", "");
    log("info", chalk.dim("thinking..."), true);
    log("info", "");

    const mdStream = logger.createMarkdownStreamLogger();
    let response = await sdk.req(
      "hover/image",
      {
        needle: description,
        image: await captureScreenBase64(),
        intent: action,
        displayMultiple: 1,
      },
      (chunk) => {
        if (chunk.type === "data") {
          mdStream.log(chunk.data);
        } else if (chunk.type === "closeMatches") {
          emitter.emit(events.matches.show, chunk.data);
        }
      },
    );
    mdStream.end();

    if (!response?.data) {
      throw new AiError("No image or icon on screen matches description");
    } else {
      return response.data;
    }
  },
  "match-image": async (
    relativePath,
    action = "click"
  ) => {
    let image = await captureScreenPNG();

    let result = await findImageOnScreen(relativePath, image);

    if (!result) {
      throw new AiError(`Image not found: ${relativePath}`, true);
    } else {
      if (action === "click") {
        await click(result.centerX, result.centerY, action);
      } else if (action === "hover") {
        await hover(result.centerX, result.centerY);
      }
    }
  },
  // type a string
  type: async (string) => {
    await redraw.start();
    string = string.toString();
    await robot.typeString(string);
    await redraw.wait(5000);
    return;
  },
  // press keys
  // different than `type`, becasue it can press multiple keys at once
  "press-keys": async (inputKeys) => {
    await redraw.start();

    // robotjs is finiky with key-up on modifier keys
    // so we do a bunch of annoying stuff to make sure it works
    const modifierKeys = ["alt", "win", "control", "shift", "command"];

    // find modifier keys, remove them from the inputKeys array and push them to a new array
    let modifierKeysPressed = [];
    let keysPressed = [];

    // remove any modifier keys from the inputKeys array and put them in a new array
    inputKeys.forEach((key) => {
      // change command to control on windows
      if (key === "command" && process.platform === "win32") {
        key = "control";
      }

      if (modifierKeys.includes(key)) {
        modifierKeysPressed.push(key);
      } else {
        keysPressed.push(key);
      }
    });

    // make sure all keys are valid
    keysPressed.forEach((key) => {
      if (keymap[key] === undefined) {
        log("error", `Key not found: ${key}`);
        throw new AiError(`Key not found: ${key}`);
      }
    });

    // only one key can be pressed at a time
    if (keysPressed.length > 1) {
      throw new AiError(
        "Only one key can be pressed at a time. However, multiple modifier keys can be pressed at the same time.",
      );
    }

    // make sure modifier keys are valid, multiple are allowed
    let modsToPress = modifierKeysPressed.map((key) => {
      if (keymap[key] === undefined) {
        log("error", `Modifier key not found: ${key}`);
        throw new AiError(`Modifier key not found: ${key}`);
      } else {
        return keymap[key];
      }
    });

    // finally, press the keys
    robot.keyTap(keysPressed[0], modsToPress);

    await redraw.wait(5000);

    // keyTap will release the normal keys, but will not release modifier keys
    // so we need to release the modifier keys manually
    modsToPress.forEach((key) => {
      robot.keyToggle(key, "up");
    });

    return;
  },
  // simple delay, usually to let ui render or webpage to load
  wait: async (timeout = 3000) => {
    return await delay(timeout);
  },
  "wait-for-image": async (description, timeout = 5000) => {
    log("info", "");
    log(
      "info",
      chalk.dim(
        `waiting for an image matching description "${description}"...`,
      ),
      true,
    );

    let startTime = new Date().getTime();
    let durationPassed = 0;
    let passed = false;

    while (durationPassed < timeout && !passed) {
      const response = await sdk.req("assert", {
        needle: description,
        image: await captureScreenBase64(),
      });
      passed = response.data;

      durationPassed = new Date().getTime() - startTime;
      if (!passed) {
        log(
          "info",
          chalk.dim(
            `${niceSeconds(durationPassed)} seconds have passed without finding an image matching the description "${description}"`,
          ),
          true,
        );
      }
    }

    if (passed) {
      log(
        "info",
        chalk.dim(`An image matching the description "${description}" found!`),
        true,
      );
      return;
    } else {
      throw new AiError(
        `Timed out (${niceSeconds(timeout)} seconds) while searching for an image matching the description "${description}"`,
        true,
      );
    }
  },
  "wait-for-text": async (text, timeout = 5000, method = "turbo") => {
    await redraw.start();

    log("info", chalk.dim(`waiting for text: "${text}"...`), true);

    let startTime = new Date().getTime();
    let durationPassed = 0;

    let passed = false;

    while (durationPassed < timeout && !passed) {
      const response = await sdk.req(
        "assert/text",
        {
          needle: text,
          method: method,
          image: await captureScreenBase64(),
        },
        (chunk) => {
          if (chunk.type === "closeMatches") {
            emitter.emit(events.matches.show, chunk.data);
          }
        },
      );

      passed = response.data;
      durationPassed = new Date().getTime() - startTime;
      if (!passed && durationPassed > timeout) {
        log(
          "info",
          chalk.dim(
            `${niceSeconds(durationPassed)} seconds have passed without finding "${text}"`,
          ),
          true,
        );
        await redraw.wait(5000);
      }
    }

    if (passed) {
      log("info", chalk.dim(`"${text}" found!`), true);
      return;
    } else {
      throw new AiError(
        `Timed out (${niceSeconds(timeout)} seconds) while searching for "${text}:.}`,
        true,
      );
    }
  },
  "scroll-until-text": async (
    text,
    direction = "down",
    maxDistance = 1200,
    textMatchMethod = "turbo",
    method = "keyboard"
  ) => {
    await redraw.start();

    log("info", chalk.dim(`scrolling for text: "${text}"...`), true);

    if (method === "keyboard") {
      try {
        // use robot to press CMD+F
        await robot.keyTap("f", commandOrControl);
        // keyTap will release the normal keys, but will not release modifier keys
        // so we need to release the modifier keys manually
        robot.keyToggle(commandOrControl, "up");
        // type the text
        await robot.typeString(text);
        await redraw.wait(5000);
        await robot.keyTap("escape");
      } catch (e) {
        console.log(e);
        throw new AiError(
          "Could not find element using browser text search",
          true,
        );
      }
    }

    let scrollDistance = 0;
    let incrementDistance = 300;
    if (method === "mouse") {
      incrementDistance = 200;
    }
    let passed = false;

    while (scrollDistance <= maxDistance && !passed) {
      const response = await sdk.req(
        "assert/text",
        {
          needle: text,
          method: textMatchMethod,
          image: await captureScreenBase64(),
        },
        (chunk) => {
          if (chunk.type === "closeMatches") {
            emitter.emit(events.matches.show, chunk.data);
          }
        },
      );

      passed = response.data;
      if (!passed) {
        log(
          "info",
          chalk.dim(
            `scrolling ${direction} ${incrementDistance}px. ${scrollDistance + incrementDistance}/${maxDistance}px scrolled...`,
          ),
          true,
        );
        await scroll(direction, incrementDistance, method);
        scrollDistance = scrollDistance + incrementDistance;
      }
    }

    if (passed) {
      log("info", chalk.dim(`"${text}" found!`), true);
      return;
    } else {
      throw new AiError(
        `Scrolled ${scrollDistance} pixels without finding "${text}"`,
        true,
      );
    }
  },
  "scroll-until-image": async (
    description,
    direction = "down",
    maxDistance = 10000,
    method = "keyboard",
  ) => {
    log(
      "info",
      chalk.dim(`scrolling for an image matching "${description}"...`),
      true,
    );

    let scrollDistance = 0;
    let incrementDistance = 500;
    let passed = false;

    while (scrollDistance < maxDistance && !passed) {
      const response = await sdk.req("assert", {
        needle: `An image matching the description "${description}" appears on screen.`,
        image: await captureScreenBase64(),
      });

      passed = response.data;
      if (!passed) {
        log(
          "info",
          chalk.dim(`scrolling ${direction} ${incrementDistance} pixels...`),
          true,
        );
        await scroll(direction, incrementDistance, method);
        scrollDistance = scrollDistance + incrementDistance;
      }
    }

    if (passed) {
      log("info", chalk.dim(`"${description}" found!`), true);
      return;
    } else {
      throw new AiError(
        `Scrolled ${scrollDistance} pixels without finding an image matching "${description}"`,
        true,
      );
    }
  },
  // run applescript to focus an application by name
  "focus-application": async (name) => {
    await redraw.start();
    await focusApplication(name);
    await redraw.wait(1000);
    return "The application was focused.";
  },
  remember: async (description, value) => {
    await sdk.req("remember", { description, value });

    return `${description} will be remembered as ${value}`; // important, otherwise we get in a loop of membering
  },
  assert: async (assertion, async = false) => {
    return await assert(assertion, true, async);
  },
};

module.exports = { commands, assert };
