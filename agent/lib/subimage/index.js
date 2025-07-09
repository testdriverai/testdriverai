/* eslint-disable no-undef */
const Jimp = require("jimp");
const path = require("path");
const cv = require("./opencv.js");
const { events, emitter } = require("../../events");

async function findTemplateImage(haystack, needle, threshold) {
  try {
    const positions = [];

    const imageSource = await Jimp.read(path.join(haystack));
    const imageTemplate = await Jimp.read(path.join(needle));

    const templ = cv.matFromImageData(imageTemplate.bitmap);
    let src = cv.matFromImageData(imageSource.bitmap);
    let processedImage = new cv.Mat();
    let mask = new cv.Mat();

    cv.matchTemplate(src, templ, processedImage, cv.TM_CCOEFF_NORMED, mask);

    cv.threshold(
      processedImage,
      processedImage,
      threshold,
      1,
      cv.THRESH_BINARY,
    );
    processedImage.convertTo(processedImage, cv.CV_8UC1);
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();

    cv.findContours(
      processedImage,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE,
    );

    for (let i = 0; i < contours.size(); ++i) {
      let [x, y] = contours.get(i).data32S; // Contains the points
      positions.push({
        x,
        y,
        height: templ.rows,
        width: templ.cols,
        centerX: x + templ.cols / 2,
        centerY: y + templ.rows / 2,
      });
    }

    src.delete();
    mask.delete();
    templ.delete();

    return positions;
  } catch (err) {
    emitter.emit(events.subimage.error, {
      error: err,
      message: "OpenCV threw an error",
      haystack,
      needle,
      threshold,
    });
  }
}

function onRuntimeInitialized() {}

// Finally, load the open.js as before. The function `onRuntimeInitialized` contains our program.
Module = {
  onRuntimeInitialized,
};

module.exports = {
  findTemplateImage,
};
