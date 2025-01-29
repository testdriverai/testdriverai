import semver from 'semver';
import packageJson from '../package.json';

// Function to check if the new version's minor version is >= current version's minor version
export default (inputVersion) => {
  const currentParsed = semver.parse(packageJson.version);
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
