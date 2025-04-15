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
  logger.info(chalk.dim("Choose a runner:"));
  logger.info("");
  logger.info(chalk.green("Local Runner:" + chalk.white(" Free")));
  logger.info(chalk.dim("Uses your computer to execute tests."));
  logger.info("");
  logger.info(
    chalk.green("Sandbox Runner: " + chalk.white("14 Day Trial then $~3/hr")),
  );
  logger.info(chalk.dim("Private hosted ephemeral VMs"));
  logger.info(chalk.dim("- added privacy"));
  logger.info(chalk.dim("- faster execution"));
  logger.info(chalk.dim("- parallel execution"));
  logger.info(chalk.dim("- better DX"));
  logger.info("");

  const response = await prompts([
    {
      type: "confirm",
      name: "TD_VM",
      message: "Use TestDriver Sandbox Runners? (Recommended)",
      initial: true,
    },
    {
      type: (prev) => (prev ? "password" : null),
      name: "TD_API_KEY",
      message: "API KEY (from https://app.testdriver.ai/team)",
    },
    {
      type: (prev) => (prev ? null : "confirm"),
      name: "TD_MINIMIZE",
      message: "Minimize terminal app?",
      initial: false,
    },
    {
      type: (prev) => (prev ? null : "confirm"),
      name: "TD_NOTIFY",
      message: "Enable desktop notifications?",
      initial: true,
    },
    {
      type: (prev) => (prev ? null : "confirm"),
      name: "TD_SPEAK",
      message: "Enable text to speech narration?",
      initial: true,
    },

    {
      type: "select",
      name: "TD_TYPE",
      message: "What type of app are you testing?",
      choices: [
        { title: "Website", value: "website" },
        { title: "Mobile", value: "mobile" },
        { title: "Desktop", value: "desktop" },
      ],
      initial: 0,
    },
    {
      type: (prev) => (prev === "website" ? "text" : null),
      name: "TD_WEBSITE",
      message: "What is the root URL of your website?",
      initial: "https://testdriver-sandbox.vercel.app",
    },
    {
      type: "confirm",
      name: "TD_ANALYTICS",
      message: "Send anonymous analytics?",
      initial: true,
    },
  ]);

  logger.info("");
  logger.info(chalk.dim(`Writing .env...`));
  logger.info("");
  logger.info(`Downloading latest workflow files...`);
  logger.info("");

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
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  await fs.writeFileSync(append, updatedEnv);

  let resolvedPath = await getLatestRelease("testdriverai", "quickstart-web");

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

  logger.info("");
  logger.info(chalk.green("Testdriver setup complete!"));
  logger.info("");
  logger.info(chalk.yellow("Create a new test by running:"));
  logger.info("testdriverai testdriver/test.yaml");
};
