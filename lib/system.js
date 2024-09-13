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

// Function to detect display scaling
detectDisplayScaling = async function() {
  return new Promise((resolve, reject) => {
    const ps = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Drawing;
public class DPI {
    [DllImport("gdi32.dll")]
    static extern int GetDeviceCaps(IntPtr hdc, int nIndex);
    public enum DeviceCap {
        VERTRES = 10,
        DESKTOPVERTRES = 117
    }
    public static float scaling() {
        Graphics g = Graphics.FromHwnd(IntPtr.Zero);
        IntPtr desktop = g.GetHdc();
        int LogicalScreenHeight = GetDeviceCaps(desktop, (int)DeviceCap.VERTRES);
        int PhysicalScreenHeight = GetDeviceCaps(desktop, (int)DeviceCap.DESKTOPVERTRES);
        return (float)PhysicalScreenHeight / (float)LogicalScreenHeight;
    }
}
"@ -ReferencedAssemblies 'System.Drawing.dll' -ErrorAction Stop
[DPI]::scaling() * 100
      `.trim()
    ]);

    let output = '';

    ps.stdout.on('data', (data) => {
      output += data.toString();
    });

    ps.stderr.on('data', (data) => {
      console.error(`Error: ${data}`);
    });

    ps.on('close', (code) => {
      if (code === 0) {
        const scaling = parseFloat(output.trim());
        resolve(scaling);
      } else {
        reject(new Error(`PowerShell script exited with code ${code}`));
      }
    });
  });
}

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

  if (platform() === 'windows') {
    displayMultiple = 100 / await detectDisplayScaling();
  } else {
    return 1;
  }
};

const tmpFilename = () => {
  return path.join(os.tmpdir(), `${new Date().getTime() + Math.random()}.png`); 
}

// our handy screenshot function
const captureScreenBase64 = async (scale = 1) => {

  let primaryDisplay = await getPrimaryDisplay();
  
  let step1 = tmpFilename();
  let step2 = tmpFilename();

  console.log(step1, step2)

  let step1Screenshot = await screenshot({ filename: step1, format: 'png' });

  console.log(primaryDisplay)
  console.log(await sharp(step1Screenshot).metadata())

  // // resize to 1:1 px ratio
  await sharp(step1)
    .resize(Math.floor(primaryDisplay.currentResX * scale), Math.floor(primaryDisplay.currentResY * scale))
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
