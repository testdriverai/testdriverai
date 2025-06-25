const { captureScreenPNG } = require("./system");
const os = require("os");
const path = require("path");
const { compare } = require("odiff-bin");
const logger = require("./logger").logger;
const theme = require("./theme");

// network
const si = require("systeminformation");

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

const parseNetworkStats = (thisRxBytes, thisTxBytes) => {
  diffRxBytes = lastRxBytes !== null ? thisRxBytes - lastRxBytes : 0;
  diffTxBytes = lastTxBytes !== null ? thisTxBytes - lastTxBytes : 0;

  lastRxBytes = thisRxBytes;
  lastTxBytes = thisTxBytes;

  measurements.push({ rx: diffRxBytes, tx: diffTxBytes });

  if (measurements.length > 60) {
    measurements.shift();
  }

  let avgRx =
    measurements.reduce((acc, m) => acc + m.rx, 0) / measurements.length;
  let avgTx =
    measurements.reduce((acc, m) => acc + m.tx, 0) / measurements.length;

  let stdDevRx = Math.sqrt(
    measurements.reduce((acc, m) => acc + Math.pow(m.rx - avgRx, 2), 0) /
      measurements.length,
  );
  let stdDevTx = Math.sqrt(
    measurements.reduce((acc, m) => acc + Math.pow(m.tx - avgTx, 2), 0) /
      measurements.length,
  );

  let zIndexRx = stdDevRx !== 0 ? (diffRxBytes - avgRx) / stdDevRx : 0;
  let zIndexTx = stdDevTx !== 0 ? (diffTxBytes - avgTx) / stdDevTx : 0;

  if (zIndexRx < 0 && zIndexTx < 0) {
    networkSettled = true;
  } else {
    networkSettled = false;
  }
};

async function updateNetwork() {
  const { exec } = require("child_process");
  const scriptPath = path.join(__dirname, "network.ps1");
  if (os.platform() === "win32") {
    exec(`powershell -File ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Error executing PowerShell script: ${error}`);
        return;
      }
      if (stderr) {
        logger.error(`PowerShell error: ${stderr}`);
        return;
      }

      try {
        // Parse the JSON output
        const result = JSON.parse(stdout.trim());
        parseNetworkStats(result.totalBytesReceived, result.totalBytesSent);
      } catch (parseError) {
        logger.error(`Error parsing JSON: ${parseError}`);
      }
    });
  } else if (os.platform() === "darwin") {
    si.networkStats().then((data) => {
      parseNetworkStats(data[0].rx_bytes, data[0].tx_bytes);
    });
  }
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
  console.log("draw");
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

// setInterval(updateNetwork, networkUpdateInterval);

module.exports = { start, wait };
