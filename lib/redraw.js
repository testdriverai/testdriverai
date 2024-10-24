const { captureScreenPNG } = require("./system");
const os = require("os");
const path = require("path");
const { compare } = require("odiff-bin");

// network
const si = require('systeminformation');
const chalk = require('chalk');
let lastTxBytes = null;
let lastRxBytes = null;
let measurements = [];
let networkSettled = true;
let lastUnsettled = null;
let watchNetwork = null;
let screenHasRedrawn = null;

async function resetState() {
  lastTxBytes = null;
  lastRxBytes = null;
  measurements = [];
  networkSettled = true;
  lastUnsettled = null;
}

async function updateNetwork() {
    si.networkStats().then(data => {
      let thisRxBytes = data[0].rx_bytes;
      let thisTxBytes = data[0].tx_bytes;
  
      let diffRxBytes = lastRxBytes !== null ? thisRxBytes - lastRxBytes : 0;
      let diffTxBytes = lastTxBytes !== null ? thisTxBytes - lastTxBytes : 0;
  
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
  
      // log time since unsettlement
  
      if ((new Date().getTime() - lastUnsettled) < 2000) {
        networkSettled = false;
      } else {
        
        if ((zIndexRx < 0 && zIndexTx < 0) ) {
          lastUnsettled = null;
          networkSettled = true;
        } else {
          lastUnsettled = new Date().getTime();
          networkSettled = false;
        }
  
      }
    
      if (process.env["DEV"]) {

        if (!networkSettled) {
          console.log(chalk.red(new Date().getTime(), `,${zIndexRx}`, `,${zIndexTx}`));
        } else {
          console.log(new Date().getTime(), `,${zIndexRx}`, `,${zIndexTx}`);
        }
        
      }
  
    });
}

async function imageIsDifferent(image1Url, image2Url) {

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
      if (diffPercentage > 5) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }
}

let startImage = null;

async function start() {
  resetState();
  watchNetwork = setInterval(updateNetwork, 500);
  startImage = await captureScreenPNG();
  return startImage;
}

async function checkCondition(resolve, startTime, timeoutMs) {

  let nowImage = await captureScreenPNG();
  let timeElapsed = Date.now() - startTime;

  if (!screenHasRedrawn) {
    screenHasRedrawn = await imageIsDifferent(startImage, nowImage);
  }

  if (screenHasRedrawn && networkSettled) {
    clearInterval(watchNetwork);
    resolve("Condition met");
  } else if (Date.now() - timeElapsed > timeoutMs) {
    clearInterval(watchNetwork);
    resolve("Timeout reached");
  } else {

    if (timeElapsed > 3000) {

      if (!screenHasRedrawn) {
        console.log(chalk.dim(`    waiting for screen redraw...`));
      }
      if (!networkSettled) {
        console.log(chalk.dim(`    waiting for network to settle...`));
      }

    }

    setTimeout(() => {
      checkCondition(resolve, startTime, timeoutMs);
    }, 1000);
  }
}

function wait(timeoutMs) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    checkCondition(resolve, startTime, timeoutMs);
  });
}

module.exports = { start, wait };
