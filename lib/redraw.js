import { captureScreenPNG } from './system.js';
import os from 'os';
import path from 'path';
import { compare } from 'odiff-bin';
import logger from './logger.js';
import si from 'systeminformation';
import chalk from 'chalk';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const parseNetworkStats = (thisRxBytes,thisTxBytes) => {
  diffRxBytes = lastRxBytes !== null ? thisRxBytes - lastRxBytes : 0;
  diffTxBytes = lastTxBytes !== null ? thisTxBytes - lastTxBytes : 0;

  lastRxBytes = thisRxBytes;
  lastTxBytes = thisTxBytes;

  measurements.push({ rx: diffRxBytes, tx: diffTxBytes });

  if (measurements.length > 60) {
    measurements.shift();
  }

  let avgRx = measurements.reduce((acc, m) => acc + m.rx, 0) / measurements.length;
  let avgTx = measurements.reduce((acc, m) => acc + m.tx, 0) / measurements.length;

  let stdDevRx = Math.sqrt(measurements.reduce((acc, m) => acc + Math.pow(m.rx - avgRx, 2), 0) / measurements.length);
  let stdDevTx = Math.sqrt(measurements.reduce((acc, m) => acc + Math.pow(m.tx - avgTx, 2), 0) / measurements.length);

  let zIndexRx = stdDevRx !== 0 ? (diffRxBytes - avgRx) / stdDevRx : 0;
  let zIndexTx = stdDevTx !== 0 ? (diffTxBytes - avgTx) / stdDevTx : 0;

  if ((zIndexRx < 0 && zIndexTx < 0) ) {
    networkSettled = true;
  } else {
    networkSettled = false;
  }
}

async function updateNetwork() {
  const scriptPath = path.join(__dirname, "network.ps1");
  if (os.platform() === 'win32') {
    exec(`powershell -File ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing PowerShell script: ${error}`);
        return;
      }
      if (stderr) {
        console.error(`PowerShell error: ${stderr}`);
        return;
      }
      
      try {
        // Parse the JSON output
        const result = JSON.parse(stdout.trim());
        parseNetworkStats(result.totalBytesReceived, result.totalBytesSent);
      } catch (parseError) {
        console.error(`Error parsing JSON: ${parseError}`);
      }
    });
  } else if (os.platform() === 'darwin') {
    si.networkStats().then(data => {
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
      outputDiffMask: false
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
  let nowImage = await captureScreenPNG(.25, true);
  let timeElapsed = Date.now() - startTime;
  let diffPercent = 0;
  let isTimeout = timeElapsed > timeoutMs;

  if (!screenHasRedrawn) {
    diffPercent = await imageDiffPercent(startImage, nowImage);
    screenHasRedrawn = diffPercent > redrawThresholdPercent;
  };
  
  // // log redraw as output
  let redrawText = screenHasRedrawn ? chalk.green(`y`) : chalk.dim(`${diffPercent}/${redrawThresholdPercent}%`);
  let networkText = networkSettled ? chalk.green(`y`) : chalk.dim(`${Math.trunc((diffRxBytes + diffTxBytes) / networkUpdateInterval)}b/s`);
  let timeoutText = isTimeout ?  chalk.green(`y`) : chalk.dim(`${Math.floor((timeElapsed)/1000)}/${(timeoutMs / 1000)}s`);

  logger.log("debug", `   ` + chalk.dim('redraw=') + redrawText + chalk.dim(' network=') + networkText + chalk.dim(' timeout=') + timeoutText);

  if ((screenHasRedrawn && networkSettled) || isTimeout) {
    logger.log("debug", `   `);
    resolve("true");
  } else {
    checkCondition(resolve, startTime, timeoutMs);
  }
}

function wait(timeoutMs) {
  logger.log("debug", `   `);
  return new Promise((resolve) => {
    const startTime = Date.now();
    checkCondition(resolve, startTime, timeoutMs);
  });
}

setInterval(updateNetwork, networkUpdateInterval);

export { start, wait };
