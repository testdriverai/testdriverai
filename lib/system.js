// utilities for getting information about the system
const fs = require('fs')
const os = require('os')
const path = require('path')
const screenshot = require('screenshot-desktop')
const si = require('systeminformation');
const activeWindow = require('active-win');
const robot = require('robotjs');

let displayMultiple = 0;
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

// this hepls us understand how to scale things for retina screens
const calculateDisplayMultiple = async () => {
  let primaryDisplay = await getPrimaryDisplay();
  displayMultiple = primaryDisplay.currentResX / primaryDisplay.resolutionX;
};

const getDisplayMultiple = async () => {

  if (!displayMultiple) {
    await calculateDisplayMultiple();
  }
  
  return displayMultiple;
};

const tmpFilename = () => {
  return path.join(os.tmpdir(), `${new Date().getTime() + Math.random()}.png`); 
}

// our handy screenshot function
const captureScreenBase64 = async () => {

  let primaryDisplay = await getPrimaryDisplay();
  
  let step1 = tmpFilename();

  await screenshot({ filename: step1, format: 'png' });

  let image = fs.readFileSync(step1, "base64");

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
  calculateDisplayMultiple,
  getMousePosition,
  primaryDisplay,
  activeWin,
  platform,
  getSystemInformationOsInfo
}
