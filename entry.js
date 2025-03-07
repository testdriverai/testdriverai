function enableExecFilePatch() {
  const childProcess = require("child_process");

  if (childProcess.execFile.__patched) {
    return; // Prevent multiple patches
  }

  const fs = require("fs");
  const path = require("path");
  const os = require("os");
  const originalExecFile = childProcess.execFile;

  function isInsideSnapshot(filePath) {
    return (
      filePath.startsWith("/snapshot/") || filePath.includes("C:\\snapshot\\")
    );
  }

  function getTempFilePath(originalPath) {
    return path.join(os.tmpdir(), path.basename(originalPath));
  }

  childProcess.execFile = function (file, ...args) {
    if (isInsideSnapshot(file)) {
      const tempFilePath = getTempFilePath(file);
      fs.copyFileSync(file, tempFilePath);
      fs.chmodSync(tempFilePath, 0o755);
      file = tempFilePath;
    }

    return originalExecFile(file, ...args);
  };

  Object.defineProperty(childProcess.execFile, "__patched", {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}

function addLibraryPath() {
  const fs = require("fs");
  const os = require("os");
  const path = require("path");

  const dir = path.join(os.tmpdir(), "testdriverlib");

  // Make Tmp Dir
  fs.mkdirSync(dir, { force: true, recursive: true });

  fs.writeFileSync(
    path.join(dir, "libvips-42.dll"),
    fs.readFileSync("C:\\snapshot\\testdriverai\\build\\libvips-42.dll"),
  );

  fs.writeFileSync(
    path.join(dir, "libvips-cpp.dll"),
    fs.readFileSync("C:\\snapshot\\testdriverai\\build\\libvips-cpp.dll"),
  );

  process.env.PATH = `${dir};${process.env.PATH}`;
}

enableExecFilePatch();
addLibraryPath();

require("./index.js");
