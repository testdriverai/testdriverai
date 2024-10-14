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

  console.log('imageIsDifferent', reason, diffPercentage, match);

  if (match) {
    return false;
  } else {

    if (reason === "pixel-diff") {
      console.log('pixel difference', diffPercentage);
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

function wait(timeoutMs) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    async function checkCondition() {
      let nowImage = await captureScreenPNG();
      let result = await imageIsDifferent(startImage, nowImage);

      if (result) {
        resolve("Condition met");
      } else if (Date.now() - startTime >= timeoutMs) {
        resolve("Timeout reached");
      } else {
        setTimeout(() => {
          checkCondition();
        }, 250);
      }
    }

    checkCondition();
  });
}

module.exports = { start, wait };

start();
wait(30000);
