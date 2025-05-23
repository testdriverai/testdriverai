const decompress = require("decompress");
const prompts = require("prompts");
const path = require("path");
const fs = require("fs");
const isValidVersion = require("./valid-version");
const os = require("os");
const chalk = require("chalk");
const { Readable } = require("stream");
const { logger } = require("./logger");

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
  logger.info(chalk.green("Welcome to the Testdriver Setup!"));
  logger.info("");
  logger.info(chalk.dim("This is a preview of the Testdriver.ai"));
  logger.info(chalk.dim("Please report any issues in our Discord server: "));
  logger.info(chalk.dim("https://discord.com/invite/cWDFW8DzPm"));
  logger.info("");
  logger.info("Beginning setup...");
  logger.info("");

  const response = await prompts([
    // {
    //   type: 'password',
    //   name: 'DASHCAM_API_KEY',
    //   message: 'API KEY (from https://app.dashcam.io/team)',
    //   // validate: value => (validate(value) ? true : 'Invalid API Key')
    // },
    {
      type: "confirm",
      name: "TD_NOTIFY",
      message: "Enable desktop notifications?",
      initial: true,
    },
    {
      type: "confirm",
      name: "TD_MINIMIZE",
      message: "Minimize terminal app?",
      initial: true,
    },
    {
      type: "confirm",
      name: "TD_SPEAK",
      message: "Enable text to speech narration?",
      initial: true,
    },
    {
      type: "confirm",
      name: "TD_ANALYTICS",
      message: "Send anonymous analytics?",
      initial: true,
    },
    {
      type: "text",
      name: "APPEND",
      message: "Where should we append these values?",
      initial: ".env",
    },
  ]);

  logger.info("");
  logger.info(chalk.dim(`Writing ${response.APPEND}...`));
  logger.info("");
  logger.info(`Downloading latest workflow files...`);
  logger.info("");

  const env = Object.entries(response)
    .filter(([key]) => key !== "APPEND")
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const append = path.join(process.cwd(), response.APPEND);

  if (!fs.existsSync(append)) {
    await fs.writeFileSync(append, "");
  }
  await fs.appendFileSync(append, env);

  let resolvedPath = await getLatestRelease("testdriverai", "testdriver-web");

  if (resolvedPath) {
    await decompress(resolvedPath, process.cwd(), {
      strip: 1,
      filter: (file) => {
        let pass =
          file.path.startsWith("testdriver") || file.path.startsWith(".github");
        if (pass) {
          logger.info(chalk.dim(`Writing ${file.path}`));
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
  }

  logger.info("");
  logger.info(chalk.green("Testdriver setup complete!"));
  logger.info("");
  logger.info(chalk.yellow("Create a new test by running:"));
  logger.info("npx testdriverai@beta testdriver/test.yml");
};
