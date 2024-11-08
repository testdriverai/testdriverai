const { captureScreenPNG } = require("./system");
const os = require("os");
const path = require("path");
const { compare } = require("odiff-bin");

// network
const si = require('systeminformation');
const chalk = require('chalk');

const networkCooldownMs = 5000;
const redrawThresholdPercent = 3;

let lastTxBytes = null;
let lastRxBytes = null;
let measurements = [];
let networkSettled = true;
let lastUnsettled = null;
let screenHasRedrawn = null;

async function resetState() {
  lastTxBytes = null;
  lastRxBytes = null;
  measurements = [];
  networkSettled = true;
  lastUnsettled = null;
  screenHasRedrawn = false;
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
  
      if ((new Date().getTime() - lastUnsettled) > networkCooldownMs) {
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
  startImage = await captureScreenPNG(1, true);
  return startImage;
}

async function checkCondition(resolve, startTime, timeoutMs) {
  let nowImage = await captureScreenPNG(.5, true);
  let timeElapsed = Date.now() - startTime;
  let diffPercent = 0;
  let isTimeout = timeElapsed > timeoutMs;

  if (!screenHasRedrawn) {
    diffPercent = await imageDiffPercent(startImage, nowImage);
    screenHasRedrawn = diffPercent > redrawThresholdPercent;
  }

  // // log redraw as output
  let redrawText = screenHasRedrawn ? chalk.green(`y`) : chalk.dim(`${diffPercent}/${redrawThresholdPercent}%`);
  let networkText = networkSettled ? chalk.green(`y`) : chalk.dim(`${Math.floor((new Date().getTime() - lastUnsettled) / 1000)}/${Math.floor(networkCooldownMs/1000)}s`);
  let timeoutText = isTimeout ?  chalk.green(`y`) : chalk.dim(`${Math.floor((timeElapsed)/1000)}/${(timeoutMs / 1000)}s`);

  console.log(`   `, chalk.dim('redraw='), redrawText, chalk.dim('network='), networkText, chalk.dim('timeout='), timeoutText);

  if ((screenHasRedrawn && networkSettled) || isTimeout) {
    console.log('')
    resolve("true");
  } else {
    checkCondition(resolve, startTime, timeoutMs);
  }
}

function wait(timeoutMs) {
  console.log("")
  return new Promise((resolve) => {
    const startTime = Date.now();
    checkCondition(resolve, startTime, timeoutMs);
  });
}

setInterval(updateNetwork, 2000);

module.exports = { start, wait };
