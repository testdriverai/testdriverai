const semver = require("semver");
const package = require("../../package.json");

// Function to check if the new version's minor version is >= current version's minor version
module.exports = (inputVersion) => {
  const currentParsed = semver.parse(package.version);
  const inputParsed = semver.parse(inputVersion.replace("v", ""));

  if (!currentParsed || !inputParsed) {
    throw new Error("Invalid version format");
  }

  // Compare major and minor versions
  if (
    inputParsed.major === currentParsed.major &&
    inputParsed.minor <= currentParsed.minor
  ) {
    return true;
  }
  return false;
};
