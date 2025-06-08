const decompress = require("decompress");
// Removed prompts import
const path = require("path");
const fs = require("fs");
const isValidVersion = require("./valid-version");
const os = require("os");
const { Readable } = require("stream");
const { logger } = require("./logger");
const theme = require("./theme");

// Minimal CLI argument parser
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  args.forEach((arg) => {
    if (arg.startsWith("--")) {
      const [key, ...rest] = arg.slice(2).split("=");
      result[key] = rest.length > 0 ? rest.join("=") : true;
    }
  });
  return result;
}

async function getLatestRelease(owner, repo) {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases`,
    );
    const releases = await response.json();

    // Filter releases that are less than or equal to the version in package.json
    const validReleases = releases.filter((release) => {
      isValidVersion(release.tag_name);
      return true;
    });

    if (validReleases.length > 0) {
      const latestRelease = validReleases[0];

      // Download the source code
      const sourceUrl = latestRelease.tarball_url;
      const downloadResponse = await fetch(sourceUrl);

      const tmpDir = os.tmpdir();
      const path2 = path.join(
        tmpDir,
        `${repo}-${latestRelease.tag_name}.tar.gz`,
      );
      const dest = fs.createWriteStream(path2);

      return new Promise((resolve, reject) => {
        Readable.fromWeb(downloadResponse.body).pipe(dest, {
          end: true,
        });

        dest.on("finish", () => {
          resolve(path2);
        });

        dest.on("error", (error) => {
          reject(error);
        });
      });
    } else {
      logger.info("No valid release found.");
      return false;
    }
  } catch (error) {
    logger.error("Error fetching releases: %s", error.message);
    return false;
  }
}

module.exports = async () => {
  // Parse CLI args
  const cliArgs = parseArgs();

  // Map CLI args to expected keys with defaults
  const response = {
    TD_VM: cliArgs.TD_VM,
    TD_API_KEY: cliArgs.TD_API_KEY,
    TD_TYPE: cliArgs.TD_TYPE,
    TD_WEBSITE: cliArgs.TD_WEBSITE,
    TD_ANALYTICS: cliArgs.TD_ANALYTICS,
  };

  logger.info(theme.dim(`Writing .env...`));
  logger.info("");

  // Write CLI args to .env
  const append = path.join(process.cwd(), ".env");
  const existingEnv = fs.existsSync(append)
    ? fs.readFileSync(append, "utf8")
    : "";
  const envMap = existingEnv.split("\n").reduce((acc, line) => {
    const [key, value] = line.split("=");
    if (key) acc[key] = value;
    return acc;
  }, {});

  Object.entries(response).forEach(([key, value]) => {
    envMap[key] = value; // Overwrite or add new key-value pairs
  });

  const updatedEnv = Object.entries(envMap)
    .filter(([key, value]) => key && value) // Filter out empty keys or values
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  await fs.writeFileSync(append, updatedEnv);

  // Only download workflow files if TD_TYPE is website
  if (response.TD_TYPE === "website") {
    logger.info(`Downloading latest workflow files...`);
    logger.info("");

    let resolvedPath = await getLatestRelease("testdriverai", "quickstart-web");

    if (resolvedPath) {
      await decompress(resolvedPath, process.cwd(), {
        strip: 1,
        filter: (file) => {
          let pass =
            file.path.startsWith("testdriver") ||
            file.path.startsWith(".github");
          if (pass) {
            logger.info(theme.dim(`Writing ${file.path}`));
          }
          return pass;
        },
      });

      // Create a folder named "testdriver" if it doesn't exist
      const testdriverFolder = path.join(process.cwd(), "testdriver");
      if (!fs.existsSync(testdriverFolder)) {
        fs.mkdirSync(testdriverFolder);
      }

      const testdriverGenerateFolder = path.join(
        process.cwd(),
        "testdriver",
        "generate",
      );
      if (!fs.existsSync(testdriverGenerateFolder)) {
        fs.mkdirSync(testdriverGenerateFolder);
      }

      const tdScreen = path.join(process.cwd(), "testdriver", "screenshots");
      if (!fs.existsSync(tdScreen)) {
        fs.mkdirSync(tdScreen);
      }
      const tdScreenMac = path.join(
        process.cwd(),
        "testdriver",
        "screenshots",
        "mac",
      );
      if (!fs.existsSync(tdScreenMac)) {
        fs.mkdirSync(tdScreenMac);
      }
      const tdScreenWindows = path.join(
        process.cwd(),
        "testdriver",
        "screenshots",
        "windows",
      );
      if (!fs.existsSync(tdScreenWindows)) {
        fs.mkdirSync(tdScreenWindows);
      }
      const tdScreenLinux = path.join(
        process.cwd(),
        "testdriver",
        "screenshots",
        "linux",
      );
      if (!fs.existsSync(tdScreenLinux)) {
        fs.mkdirSync(tdScreenLinux);
      }
    }
  }

  logger.info(theme.dim("TestDriver setup complete!"));
  logger.info("");
  logger.info(theme.green("Create a new test by running:"));
  logger.info("testdriverai testdriver/test.yaml");
};
