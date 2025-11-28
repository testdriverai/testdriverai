const { PNG } = require("pngjs");
const fs = require("fs");
const { events } = require("../events");
const theme = require("./theme");

// Default redraw options
const DEFAULT_REDRAW_OPTIONS = {
  enabled: true,           // Master switch to enable/disable redraw detection
  screenRedraw: true,      // Enable screen redraw detection
  networkMonitor: true,    // Enable network activity monitoring
  diffThreshold: 0.1,      // Percentage threshold for screen diff (0.1 = 0.1%)
};

// Factory function that creates redraw functionality with the provided system instance
const createRedraw = (
  emitter,
  system,
  sandbox,
  defaultOptions = {},
) => {
  // Merge default options with provided defaults
  const baseOptions = { ...DEFAULT_REDRAW_OPTIONS, ...defaultOptions };
  // Support legacy redrawThresholdPercent number argument
  if (typeof defaultOptions === 'number') {
    baseOptions.diffThreshold = defaultOptions;
  }
  
  const networkUpdateInterval = 15000;

  let lastTxBytes = null;
  let lastRxBytes = null;

  let diffRxBytes = 0;
  let diffTxBytes = 0;

  let measurements = [];
  let networkSettled = true;
  let screenHasRedrawn = null;

  // Track network interval to ensure only one exists
  let networkInterval = null;

  const resetState = () => {
    lastTxBytes = null;
    lastRxBytes = null;
    measurements = [];
    networkSettled = true;
    screenHasRedrawn = false;
  };

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
    if (sandbox && sandbox.instanceSocketConnected) {
      let network = await sandbox.send({
        type: "system.network",
      });
      parseNetworkStats(
        network.out.totalBytesReceived,
        network.out.totalBytesSent,
      );
    }
  }

  async function imageDiffPercent(image1Url, image2Url) {
    try {
      // Dynamic import for ES module pixelmatch
      const { default: pixelmatch } = await import("pixelmatch");

      // Read PNG files
      const img1Buffer = fs.readFileSync(image1Url);
      const img2Buffer = fs.readFileSync(image2Url);

      // Parse PNG data
      const img1 = PNG.sync.read(img1Buffer);
      const img2 = PNG.sync.read(img2Buffer);

      // Ensure images have the same dimensions
      if (img1.width !== img2.width || img1.height !== img2.height) {
        throw new Error("Images must have the same dimensions");
      }

      const { width, height } = img1;
      const totalPixels = width * height;

      // Create diff image buffer
      const diff = new PNG({ width, height });

      // Compare images using pixelmatch
      const differentPixels = pixelmatch(
        img1.data,
        img2.data,
        diff.data,
        width,
        height,
        { threshold: 0.1 },
      );

      // Calculate percentage difference based on pixel differences
      // Always return a number (0 if no difference)
      const diffPercentage = (differentPixels / totalPixels) * 100;
      return parseFloat(diffPercentage.toFixed(2));
    } catch (error) {
      console.error("Error comparing images:", error);
      return 0; // Return 0 on error instead of false
    }
  }

  let startImage = null;

  // Start network monitoring only when needed
  function startNetworkMonitoring() {
    if (!networkInterval) {
      networkInterval = setInterval(updateNetwork, networkUpdateInterval);
    }
  }

  // Stop network monitoring
  function stopNetworkMonitoring() {
    if (networkInterval) {
      clearInterval(networkInterval);
      networkInterval = null;
    }
  }

  // Current options for the active redraw cycle
  let currentOptions = { ...baseOptions };

  async function start(options = {}) {
    // Merge base options with per-call options
    currentOptions = { ...baseOptions, ...options };
    
    console.log('[redraw] start() called with options:', JSON.stringify(currentOptions));
    
    // If redraw is completely disabled, return early
    if (!currentOptions.enabled) {
      console.log('[redraw] start() - redraw disabled, returning null');
      return null;
    }
    
    // If both screenRedraw and networkMonitor are disabled, disable redraw
    if (!currentOptions.screenRedraw && !currentOptions.networkMonitor) {
      currentOptions.enabled = false;
      console.log('[redraw] start() - both screenRedraw and networkMonitor disabled, returning null');
      return null;
    }
    
    resetState();
    
    // Only start network monitoring if enabled
    if (currentOptions.networkMonitor) {
      startNetworkMonitoring();
    }
    
    // Only capture start image if screen redraw is enabled
    if (currentOptions.screenRedraw) {
      startImage = await system.captureScreenPNG(0.25, true);
      console.log('[redraw] start() - captured startImage:', startImage);
    }
    
    return startImage;
  }

  async function checkCondition(resolve, startTime, timeoutMs, options) {
    const { enabled, screenRedraw, networkMonitor, diffThreshold } = options;
    
    // If redraw is disabled, resolve immediately
    if (!enabled) {
      resolve("true");
      return;
    }
    
    let nowImage = screenRedraw ? await system.captureScreenPNG(0.25, true) : null;
    let timeElapsed = Date.now() - startTime;
    let diffPercent = 0;
    let isTimeout = timeElapsed > timeoutMs;

    // Check screen redraw if enabled and we have a start image to compare against
    if (screenRedraw && !screenHasRedrawn && startImage && nowImage) {
      console.log('[redraw] checkCondition() - comparing images:', { startImage, nowImage });
      diffPercent = await imageDiffPercent(startImage, nowImage);
      console.log('[redraw] checkCondition() - diffPercent:', diffPercent, 'threshold:', diffThreshold);
      screenHasRedrawn = diffPercent > diffThreshold;
      console.log('[redraw] checkCondition() - screenHasRedrawn:', screenHasRedrawn);
    } else if (screenRedraw && !startImage) {
      // If no start image was captured, capture one now and wait for next check
      console.log('[redraw] checkCondition() - no startImage, capturing now');
      startImage = await system.captureScreenPNG(0.25, true);
    }
    
    // If screen redraw is disabled, consider it as "redrawn"
    const effectiveScreenRedrawn = screenRedraw ? screenHasRedrawn : true;
    // If network monitor is disabled, consider it as "settled"
    const effectiveNetworkSettled = networkMonitor ? networkSettled : true;

    // Log redraw status
    let redrawText = !screenRedraw
      ? theme.dim(`disabled`)
      : effectiveScreenRedrawn
        ? theme.green(`y`)
        : theme.dim(`${diffPercent}/${diffThreshold}%`);
    let networkText = !networkMonitor
      ? theme.dim(`disabled`)
      : effectiveNetworkSettled
        ? theme.green(`y`)
        : theme.dim(
            `${Math.trunc((diffRxBytes + diffTxBytes) / networkUpdateInterval)}b/s`,
          );
    let timeoutText = isTimeout
      ? theme.green(`y`)
      : theme.dim(`${Math.floor(timeElapsed / 1000)}/${timeoutMs / 1000}s`);

    emitter.emit(events.redraw.status, {
      redraw: {
        enabled: screenRedraw,
        hasRedrawn: effectiveScreenRedrawn,
        diffPercent,
        threshold: diffThreshold,
        text: redrawText,
      },
      network: {
        enabled: networkMonitor,
        settled: effectiveNetworkSettled,
        rxBytes: diffRxBytes,
        txBytes: diffTxBytes,
        text: networkText,
      },
      timeout: {
        isTimeout,
        elapsed: timeElapsed,
        max: timeoutMs,
        text: timeoutText,
      },
    });

    if ((effectiveScreenRedrawn && effectiveNetworkSettled) || isTimeout) {
      emitter.emit(events.redraw.complete, {
        screenHasRedrawn: effectiveScreenRedrawn,
        networkSettled: effectiveNetworkSettled,
        isTimeout,
        timeElapsed,
      });
      resolve("true");
    } else {
      setTimeout(() => {
        checkCondition(resolve, startTime, timeoutMs, options);
      }, 500);
    }
  }

  function wait(timeoutMs, options = {}) {
    // Merge current options with any per-call overrides
    const waitOptions = { ...currentOptions, ...options };
    
    // If redraw is disabled, resolve immediately
    if (!waitOptions.enabled) {
      return Promise.resolve("true");
    }
    
    // If both are disabled, resolve immediately
    if (!waitOptions.screenRedraw && !waitOptions.networkMonitor) {
      return Promise.resolve("true");
    }
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      // Start network monitoring if not already started and enabled
      if (waitOptions.networkMonitor) {
        startNetworkMonitoring();
      }
      checkCondition(resolve, startTime, timeoutMs, waitOptions);
    });
  }

  function cleanup() {
    stopNetworkMonitoring(networkInterval);
  }

  return { start, wait, cleanup, DEFAULT_OPTIONS: DEFAULT_REDRAW_OPTIONS };
};

module.exports = { createRedraw, DEFAULT_REDRAW_OPTIONS };
