const { captureScreenPNG } = require("./system");

const { compare } = require("odiff-bin");

async function imageIsDifferent(image1Url, image2Url) {

  const { reason, diffPercentage, match } = await compare(
    image1Url,
    image2Url,
    "/tmp/diff.png",
    {
      failOnLayoutDiff: false,
      outputDiffMask: false
    }
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
  startImage = await captureScreenPNG();
  return startImage;
}


async function checkCondition(resolve, startTime, timeoutMs) {
  let nowImage = await captureScreenPNG();
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
