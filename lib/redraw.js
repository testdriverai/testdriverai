const { captureScreenPNG } = require("./system");
const os = require("os");
const path = require("path");
const { compare } = require("odiff-bin");
const logger = require("./logger").logger;
const theme = require("./theme");

const redrawThresholdPercent = 3;
const networkUpdateInterval = 2000;

let lastTxBytes = null;
let lastRxBytes = null;

let diffRxBytes = 0;
let diffTxBytes = 0;

let measurements = [];
let networkSettled = true;
let screenHasRedrawn = null;

async function resetState() {
  lastTxBytes = null;
  lastRxBytes = null;
  measurements = [];
  networkSettled = true;
  screenHasRedrawn = false;
}

async function imageDiffPercent(image1Url, image2Url) {
  // generate a temporary file path
  const tmpImage = path.join(os.tmpdir(), `tmp-${Date.now()}.png`);

  const { reason, diffPercentage, match } = await compare(
    image1Url,
    image2Url,
    tmpImage,
    {
      failOnLayoutDiff: false,
      outputDiffMask: false,
    },
  );

  if (match) {
    return false;
  } else {
    if (reason === "pixel-diff") {
      return diffPercentage.toFixed(1);
    } else {
      return false;
    }
  }
}

let startImage = null;

async function start() {
  resetState();
  startImage = await captureScreenPNG(0.25, true);
  return startImage;
}

async function checkCondition(resolve, startTime, timeoutMs) {
  let nowImage = await captureScreenPNG(0.25, true);
  let timeElapsed = Date.now() - startTime;
  let diffPercent = 0;
  let isTimeout = timeElapsed > timeoutMs;

  if (!screenHasRedrawn) {
    diffPercent = await imageDiffPercent(startImage, nowImage);
    screenHasRedrawn = diffPercent > redrawThresholdPercent;
  }

  // // log redraw as output
  let redrawText = screenHasRedrawn
    ? theme.green(`y`)
    : theme.dim(`${diffPercent}/${redrawThresholdPercent}%`);
  let networkText = networkSettled
    ? theme.green(`y`)
    : theme.dim(
        `${Math.trunc((diffRxBytes + diffTxBytes) / networkUpdateInterval)}b/s`,
      );
  let timeoutText = isTimeout
    ? theme.green(`y`)
    : theme.dim(`${Math.floor(timeElapsed / 1000)}/${timeoutMs / 1000}s`);

  logger.debug(
    `   ` +
      theme.dim("redraw=") +
      redrawText +
      theme.dim(" network=") +
      networkText +
      theme.dim(" timeout=") +
      timeoutText,
  );

  if (screenHasRedrawn || isTimeout) {
    // if ((screenHasRedrawn && networkSettled) || isTimeout) {
    logger.debug(`   `);
    resolve("true");
  } else {
    setTimeout(() => {
      checkCondition(resolve, startTime, timeoutMs);
    }, 1000);
  }
}

function wait(timeoutMs) {
  logger.debug(`   `);
  return new Promise((resolve) => {
    const startTime = Date.now();
    checkCondition(resolve, startTime, timeoutMs);
  });
}

module.exports = { start, wait };
