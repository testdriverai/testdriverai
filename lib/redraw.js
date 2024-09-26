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

  console.log('wait called')

  return new Promise((resolve) => {

    const startTime = Date.now();

    async function checkCondition() {

      console.log('check condition')

      let nowImage = await captureScreenPNG();
      let result = await compareImages(startImage, nowImage);

      if (result) {
        console.log('condition met')
        resolve("Condition met");
      } else if (Date.now() - startTime >= timeoutMs) {
        console.log('timeout reached')
        resolve("Timeout reached");
      } else {
        checkCondition();
      }
    }

    return checkCondition();

  });
}

module.exports = { start, wait };
