// the actual commands to interact with the system
const sdk = require("./sdk");
const vm = require("vm");
const chalk = require("chalk");
const server = require("./ipc");
const {
  captureScreenBase64,
  captureScreenPNG,
  platform,
  activeWin,
} = require("./system");

const { focusApplication } = require("./focus-application");
const fs = require("fs").promises; // Using the promises version for async operations
const { findTemplateImage } = require("./subimage/index");
const { cwd } = require("node:process");
const path = require("path");
const Jimp = require("jimp");
const os = require("os");
const cliProgress = require("cli-progress");
const redraw = require("./redraw");
const sandbox = require("./sandbox.js");
const config = require("./config.js");
const util = require("util");
const exec = util.promisify(require("child_process").exec);
let robot;

let keymap;
if (config.TD_VM) {
  keymap = require("./keymaps/sandbox.js");
} else {
  robot = require("robotjs");
  keymap = require("./keymaps/robot.js");
}

const {
  logger,
  prettyMarkdown,
  createMarkdownStreamLogger,
} = require("./logger");
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

const commandOrControl = platform() === "darwin" ? "command" : "control";

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
    prettyMarkdown(response);

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
  logger.info("");
  logger.info(chalk.dim("thinking..."), true);
  server.broadcast("status", `thinking...`);
  logger.info("");

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
const scroll = async (direction = "down", amount = 300, method = "mouse") => {
  await redraw.start();

  amount = parseInt(amount);

  if (method === "mouse") {
    amount = 200;
  }

  switch (direction) {
    case "up":
      if (method === "mouse") {
        config.TD_VM
          ? await sandbox.send({ type: "scroll", amount })
          : await robot.scrollMouse(0, amount);
      } else {
        config.TD_VM
          ? await sandbox.send({ type: "press", keys: ["pageup"] })
          : await robot.keyTap("pageup");
      }
      await redraw.wait(2500);
      break;
    case "down":
      if (method === "mouse") {
        config.TD_VM
          ? await sandbox.send({ type: "scroll", amount: amount * -1 })
          : await robot.scrollMouse(0, amount * -1);
      } else {
        config.TD_VM
          ? await sandbox.send({ type: "press", keys: ["pagedown"] })
          : await robot.keyTap("pagedown");
      }
      await redraw.wait(2500);
      break;
    case "left":
      config.TD_VM
        ? console.log("Not Supported")
        : await robot.scrollMouse(amount * -1, 0);
      await redraw.wait(2500);
      break;
    case "right":
      config.TD_VM
        ? console.log("Not Supported")
        : await robot.scrollMouse(amount, 0);
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

  let button = "left";
  let double = false;

  if (action === "right-click" && platform !== "darwin") {
    button = "right";
  }
  if (action === "double-click") {
    double = true;
  }

  logger.debug(
    chalk.dim(`${action} ${button} clicking at ${x}, ${y}...`),
    true,
  );

  x = parseInt(x);
  y = parseInt(y);

  config.TD_VM
    ? await sandbox.send({ type: "moveMouse", x, y })
    : await robot.moveMouseSmooth(x, y, 0.1);
  emitter.emit(events.mouseMove, { x, y });

  await delay(1000); // wait for the mouse to move

  if (!config.TD_VM && platform() == "darwin" && action === "right-click") {
    robot.keyToggle("control", "down", "control");
    await delay(250);
  }

  if (action !== "hover") {
    if (config.TD_VM) {
      if (action === "click" || action === "left-click") {
        await sandbox.send({ type: "leftClick" });
      } else if (action === "right-click") {
        await sandbox.send({ type: "rightClick" });
      } else if (action === "middle-click") {
        await sandbox.send({ type: "middleClick" });
      } else if (action === "double-click") {
        await sandbox.send({ type: "doubleClick" });
      } else if (action === "drag-start") {
        await sandbox.send({ type: "mousePress", button: "left" });
      } else if (action === "drag-end") {
        await sandbox.send({ type: "mouseRelease", button: "left" });
      }
    } else {
      if (action === "drag-start") {
        robot.mouseToggle("down", button);
      } else if (action === "drag-end") {
        robot.mouseToggle("up", button);
      } else {
        robot.mouseClick(button, double);
      }
    }

    emitter.emit(events.mouseClick, { x, y, button, click });
  }

  if (!config.TD_VM && platform() == "darwin" && action === "right-click") {
    await delay(250);
    robot.keyToggle("control", "up", "control");
  }

  await redraw.wait(5000);
  return;
};

const hover = async (x, y) => {
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
    method = "turbo",
  ) => {
    text = text ? text.toString() : null;
    description = description ? description.toString() : null;

    logger.info("");
    logger.info(chalk.dim("thinking..."), true);
    logger.info("");

    // const mdStream = createMarkdownStreamLogger();
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
          
          // mdStream.log(chunk.data);

        } else if (chunk.type === "closeMatches") {
          emitter.emit(events.matches.show, chunk.data);
        }
      },
    );
    // mdStream.end();

    if (!response.data) {
      throw new AiError("No text on screen matches description");
    } else {
      return response.data;
    }
  },
  // uses our api to find all images on screen
  "hover-image": async (description, action = "click") => {
    // take a screenshot
    logger.info("");
    logger.info(chalk.dim("thinking..."), true);
    logger.info("");

    // const mdStream = createMarkdownStreamLogger();
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
          // mdStream.log(chunk.data);
        } else if (chunk.type === "closeMatches") {
          emitter.emit(events.matches.show, chunk.data);
        }
      },
    );
    // mdStream.end();

    if (!response?.data) {
      throw new AiError("No image or icon on screen matches description");
    } else {
      return response.data;
    }
  },
  "match-image": async (relativePath, action = "click") => {
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
  type: async (string, delay = 500) => {
    await redraw.start();

    string = string.toString();

    if (config.TD_VM) {
      await sandbox.send({ type: "write", text: string });
    } else {
      // there is a bug in robotjs that causes repeated characters to only be typed once
      // so we need to check for repeated characters and type them slowly if so
      const hasRepeatedChars = /(.)\1/.test(string);
      if (delay > 0 && hasRepeatedChars)
        await robot.typeStringDelayed(string, delay);
      else await robot.typeString(string);
    }
    // await redraw.wait(5000);
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
      if (key === "command" && platform() == "win32") {
        key = "control";
      }

      if (!config.TD_VM && modifierKeys.includes(key)) {
        modifierKeysPressed.push(key);
      } else {
        keysPressed.push(key);
      }
    });

    // make sure all keys are valid
    keysPressed.forEach((key) => {
      if (keymap[key] === undefined) {
        logger.error(`Key not found: ${key}`);
        throw new AiError(`Key not found: ${key}`);
      }
    });

    // only one key can be pressed at a time
    if (!config.TD_VM && keysPressed.length > 1) {
      throw new AiError(
        "Only one key can be pressed at a time. However, multiple modifier keys can be pressed at the same time.",
      );
    }

    // make sure modifier keys are valid, multiple are allowed
    let modsToPress = [];

    if (!config.TD_VM) {
      modifierKeysPressed.map((key) => {
        if (keymap[key] === undefined) {
          logger.error(`Modifier key not found: ${key}`);
          throw new AiError(`Modifier key not found: ${key}`);
        } else {
          return keymap[key];
        }
      });
      robot.keyTap(keysPressed[0], modsToPress);
    } else {
      await sandbox.send({ type: "press", keys: keysPressed });
    }

    // finally, press the keys

    await redraw.wait(5000);

    // keyTap will release the normal keys, but will not release modifier keys
    // so we need to release the modifier keys manually
    if (!config.TD_VM) {
      modsToPress.forEach((key) => {
        robot.keyToggle(key, "up");
      });
    }

    return;
  },
  // simple delay, usually to let ui render or webpage to load
  wait: async (timeout = 3000) => {
    return await delay(timeout);
  },
  "wait-for-image": async (description, timeout = 10000) => {
    logger.info("");
    logger.info(
      chalk.dim(
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
        false,
      );

      durationPassed = new Date().getTime() - startTime;
      if (!passed) {
        logger.info(
          chalk.dim(
            `${niceSeconds(durationPassed)} seconds have passed without finding an image matching the description "${description}"`,
          ),
          true,
        );
        await delay(2500);
      }
    }

    if (passed) {
      logger.info(
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

    logger.info(chalk.dim(`waiting for text: "${text}"...`), true);

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
      if (!passed) {
        logger.info(
          chalk.dim(
            `${niceSeconds(durationPassed)} seconds have passed without finding "${text}"`,
          ),
          true,
        );
        await delay(2500);
      }
    }

    if (passed) {
      logger.info(chalk.dim(`"${text}" found!`), true);
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
    method = "keyboard",
  ) => {
    await redraw.start();

    logger.info(chalk.dim(`scrolling for text: "${text}"...`), true);

    if (method === "keyboard") {
      try {
        if (!config.TD_VM) {
          await robot.keyTap("f", commandOrControl);
          robot.keyToggle(commandOrControl, "up");
          await robot.typeStringDelayed(text, 500);
        } else {
          await sandbox.send({ type: "press", keys: ["f", commandOrControl] });
          await sandbox.send({ type: "write", text });
          await redraw.wait(5000);
          await sandbox.send({ type: "press", keys: ["escape"] });
        }
      } catch (e) {
        logger.error("%s", e);
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
        logger.info(
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
      logger.info(chalk.dim(`"${text}" found!`), true);
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
    logger.info(
      chalk.dim(`scrolling for an image matching "${description}"...`),
      true,
    );

    let scrollDistance = 0;
    let incrementDistance = 500;
    let passed = false;

    while (scrollDistance <= maxDistance && !passed) {
      passed = await assert(
        `An image matching the description "${description}" appears on screen.`,
        false,
        false,
      );

      if (!passed) {
        logger.info(
          "info",
          chalk.dim(`scrolling ${direction} ${incrementDistance} pixels...`),
          true,
        );
        await scroll(direction, incrementDistance, method);
        scrollDistance = scrollDistance + incrementDistance;
      }
    }

    if (passed) {
      logger.info(chalk.dim(`"${description}" found!`), true);
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
  exec: async (language, mac_code, windows_code, linux_code, silent = true) => {
    logger.info(chalk.dim(`calling exec...`), true);

    let plat = platform();

    let scriptCode =
      plat == "linux"
        ? linux_code
        : plat == "windows"
          ? windows_code
          : plat == "mac"
            ? mac_code
            : (() => {
                throw new AiError(`Unsupported plat: ${plat}`);
              })();

    if (!scriptCode) {
      logger.warn(`No code provided for ${plat}`);
      return;
    }

    if (language == "shell") {
      logger.info(chalk.dim(`running in shell...`), true);

      let result = null;

      if (plat == "linux") {
        if (config.TD_VM) {
          logger.info(chalk.dim(`sending value of \`linux\` to vm...`), true);

          result = await sandbox.send({
            type: "commands.run",
            command: linux_code,
          });
        } else {
          if (!linux_code) {
            throw new AiError(`No code provided for linux`, true);
          }

          logger.info(
            chalk.dim(`running value of \`${plat}\` on this machine...`),
            true,
          );
          result = await exec(linux_code, { cwd: cwd() });
        }
      } else if (plat == "windows") {
        logger.info(
          chalk.dim(`running value of \`${plat}\` on this machine...`),
          true,
        );
        result = await exec(windows_code, { cwd: cwd() });
      } else if (plat == "mac") {
        logger.info(
          chalk.dim(`running value of \`${plat}\` on this machine...`),
          true,
        );
        result = await exec(mac_code, { cwd: cwd() });
      }

      if (result.out && result.out.exitCode !== 0) {
        throw new AiError(
          `Command failed with exit code ${result.out.exitCode}: ${result.out.stderr}`,
          true,
        );
      } else {
        
        if (!silent) {
          logger.info(chalk.dim(`Command output:`), true);
          logger.info(`${result.stdout}`, true)
        }

        return result.stdout.trim();
      }

    } else if (language == "js") {
      logger.info(chalk.dim(`running js...`), true);

      logger.info(
        chalk.dim(`running value of \`${plat}\` in local JS vm...`),
        true,
      );

      console.log('')
      console.log('------');

      const context = vm.createContext({ require, console, fs, process, fetch });

      scriptCode = '(async function() {\n' + scriptCode + '\n})();';

      const script = new vm.Script(scriptCode);

      try {
        await script.runInContext(context);
      } catch (e) {
        console.error(e);
        throw new AiError(
          `Error running script: ${e.message}`,
          true,
        );
      }

      // wait for context.result to resolve
      let stepResult = await context.result;

      // conver it to string
      if (typeof stepResult === "object") {
        stepResult = JSON.stringify(stepResult, null, 2);
      } else if (typeof stepResult === "function") {
        stepResult = stepResult.toString();
      }

      console.log('------');
      console.log('')

      if (!stepResult) {
        logger.info(`No result returned from script`, true);
      } else {
        if (!silent) {
          logger.info(chalk.dim(`Result:`), true);
          logger.info(stepResult, true);
        }
      }

      return stepResult;
      // }
    } else {
      throw new AiError(`Language not supported: ${language}`);
    }
  },
};

module.exports = { commands, assert };
