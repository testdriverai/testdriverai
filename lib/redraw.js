const { captureScreenPNG } = require("./system");

const Jimp = require("jimp");

async function compareImages(image1Url, image2Url) {
  const image1 = await Jimp.read(image1Url);
  const image2 = await Jimp.read(image2Url);

  // Pixel difference
  const diff = Jimp.diff(image1, image2);

  if (diff.percent < 0.15) {
    return false;
  } else {
    return true;
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
      let result = await compareImages(startImage, nowImage);

      if (result) {
        resolve("Condition met");
      } else if (Date.now() - startTime >= timeoutMs) {
        resolve("Timeout reached");
      } else {
        setTimeout(() => {
          checkCondition();
        }, 0);
      }
    }

    checkCondition();
  });
}

module.exports = { start, wait };
