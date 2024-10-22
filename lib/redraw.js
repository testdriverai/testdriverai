const { captureScreenPNG } = require("./system");
const os = require("os");
const path = require("path");
const { compare } = require("odiff-bin");

async function imageIsDifferent(image1Url, image2Url) {
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
      if (diffPercentage > 15) {
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
  startImage = await captureScreenPNG(1, true);
  return startImage;
}

async function checkCondition(resolve, startTime, timeoutMs) {
  let nowImage = await captureScreenPNG(1, true);
  let result = await imageIsDifferent(startImage, nowImage);

  if (result) {
    resolve("Condition met");
  } else if (Date.now() - startTime >= timeoutMs) {
    resolve("Timeout reached");
  } else {
    setTimeout(() => {
      checkCondition(resolve, startTime, timeoutMs);
    }, 250);
  }
}

function wait(timeoutMs) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    checkCondition(resolve, startTime, timeoutMs);
  });
}

module.exports = { start, wait };
