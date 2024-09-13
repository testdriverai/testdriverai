// utilities for getting information about the system
const fs = require('fs')
const os = require('os')
const path = require('path')
const screenshot = require('screenshot-desktop')
const si = require('systeminformation');
const activeWindow = require('active-win');
const robot = require('robotjs');
const sharp = require('sharp')

let primaryDisplay = null;

// get the primary display
// this is the only display we ever target, because fuck it
// the vm only has one and most people only have one
const getPrimaryDisplay = async () => {

  // calculate scaling resolution
  let graphics = await si.graphics();
  let primaryDisplay = graphics.displays.find((display) => display.main == true);

  return primaryDisplay;
}

const getSystemInformationOsInfo = async() => {
  return await si.osInfo();
}

const getDisplayMultiple = async () => {
  return 1;
};

const tmpFilename = () => {
  return path.join(os.tmpdir(), `${new Date().getTime() + Math.random()}.png`); 
}

// our handy screenshot function
const captureScreenBase64 = async () => {

  let primaryDisplay = await getPrimaryDisplay();
  
  let step1 = tmpFilename();
  let step2 = tmpFilename();

  console.log(step1, step2)

  let step1Screenshot = await screenshot({ filename: step1, format: 'png' });

  console.log(primaryDisplay)
  console.log(await sharp(step1Screenshot).metadata())

  // // resize to 1:1 px ratio
  await sharp(step1)
    .resize(primaryDisplay.currentResX, primaryDisplay.currentResY)
    .toFile(step2);

  // let image = fs.readFileSync(step1, "base64");
  let image = fs.readFileSync(step2, "base64");

  return image;

};

const captureScreenPNG = async () => {
      
    let step1 = tmpFilename();
    await screenshot({ filename: step1, format: 'png' });
    
    return step1;
  
}

const platform = () => {
  let platform = process.platform;
  if (platform === 'darwin') {
    platform = 'mac';
  } else if (platform === 'win32') {
    platform = 'windows';
  } else if (platform === 'linux') {
    platform = 'linux';
  } else {
    throw new Error('Unsupported platform');
  }
  return platform;
}

// this is the focused window
const activeWin = async () => {
  return await activeWindow();
}

const getMousePosition = async () => {
  return await robot.getMousePos();
}

module.exports = {
  captureScreenBase64,
  captureScreenPNG,
  getDisplayMultiple,
  getMousePosition,
  primaryDisplay,
  activeWin,
  platform,
  getSystemInformationOsInfo
}
