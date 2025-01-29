import decompress from 'decompress';
import prompts from 'prompts';
import path from 'path';
import fs from 'fs';
import isValidVersion from './valid-version.js';
import os from 'os';
import chalk from 'chalk';
import { Readable } from 'stream';

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
      console.log("No valid release found.");
      return false;
    }
  } catch (error) {
    console.error("Error fetching releases:", error.message);
    return false;
  }
}

export default async () => {
  console.log(chalk.green("Welcome to the Testdriver Setup!"));
  console.log("");
  console.log(chalk.dim("This is a preview of the Testdriver.ai"));
  console.log(chalk.dim("Please report any issues in our Discord server: "));
  console.log(chalk.dim("https://discord.com/invite/cWDFW8DzPm"));
  console.log("");
  console.log("Beginning setup...");
  console.log("");

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

  console.log("");
  console.log(chalk.dim(`Writing ${response.APPEND}...`));
  console.log("");
  console.log(`Downloading latest workflow files...`);
  console.log("");

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
          console.log(chalk.dim(`Writing ${file.path}`));
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

  console.log("");
  console.log(chalk.green("Testdriver setup complete!"));
  console.log("");
  console.log(chalk.yellow("Create a new test by running:"));
  console.log("testdriverai testdriver/test.yml");
};
