const config = require("./config");
const chalk = require("chalk");
const session = require("./session");
const version = 'v4.1.0';

const root = config["TD_API_ROOT"];
const axios = require('axios');

const { logger } = require('./logger');

// let token = null;

const outputError = async (error) => {
  logger.info(chalk.red(error.status), chalk.red(error.statusText));
};

const parseBody = async (response, body) => {
  const contentType = response.headers.get("Content-Type")?.toLowerCase();
  try {
    if (body === null || body === undefined) {
      if (!contentType.includes("json") && !contentType.includes("text")) {
        return await response.arrayBuffer();
      }
      body = response.data;
    }

    if (typeof body === "string") {
      if (contentType.includes("jsonl")) {
        const result = body
          .split("\n")
          .filter((line) => line.trim().length)
          .map((line) => JSON.parse(line))
          .reduce((result, { type, data }) => {
            if (result[type]) {
              if (typeof result[type] === "string") {
                result[type] += data;
              } else {
                result[type].push(data);
              }
            } else {
              result[type] = typeof data === "string" ? data : [data];
            }
            return result;
          }, {});
        for (const key of Object.keys(result)) {
          if (Array.isArray(result[key]) && result[key].length === 1) {
            result[key] = result[key][0];
          }
        }
        return result;
      }
      if (contentType.includes("json")) {
        return JSON.parse(body);
      }
    }
    return body;
  } catch (err) {
    logger.error(chalk.red("Parsing Error", err));
    throw err;
  }
};

let auth = async () => {
  // data.apiKey = process.env.DASHCAM_API_KEY; @todo add-auth

  // if (!data.apiKey) {
  //   logger.info(chalk.red('API key not found. Set DASHCAM_API_KEY in your environment.'));
  //   process.exit(1);
  // }

  const url = [root, "auth/exchange-api-key"].join("/");
  const config = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
    },
    // data
  };

  try {
    await axios(url, config);
    // token = res.data.token;
  } catch (error) {
    await outputError(error);
    process.exit(1);
  }
};

const req = async (path, data, onChunk) => {
  // for each value of data, if it is empty remove it
  for (let key in data) {
    if (!data[key]) {
      delete data[key];
    }
  }

  const url = path.startsWith("/api")
    ? [root, path].join("")
    : [root, "api", version, "testdriver", path].join("/");

  logger.debug(`making request to ${url}`);

  const config = {
    method: "post",
    headers: { "Content-Type": "application/json" }, 
    responseType: typeof onChunk === "function" ? "stream" : "json",
    data: {
      ...data,
      session: session.get(),
      stream: typeof onChunk === "function",
    },
  };

  try {
    let response;

    response = await axios(url, config);

    const contentType = response.headers["content-type"]?.toLowerCase();
    const isJsonl = contentType === "application/jsonl";
    let result;

    if (onChunk) {
      result = "";
      let lastLineIndex = -1;

      await new Promise((resolve, reject) => {

        // theres some kind of race condition here that makes things resolve
        // before the stream is done
        
        response.data.on('data', (chunk) => {
      
          result += chunk.toString();
          const lines = result.split("\n");

          const events = lines
            .slice(lastLineIndex + 1, lines.length - 1)
            .filter((line) => line.length)
            .map((line) => JSON.parse(line));  

          for (const event of events) {
            onChunk(event);
          }

          lastLineIndex = lines.length - 2;
        });

        response.data.on('end', () => {

          if (isJsonl) {
            const events = result
              .split("\n")
              .slice(lastLineIndex + 2)
              .filter((line) => line.length)
              .map((line) => JSON.parse(line));

            for (const event of events) {
              onChunk(event);
            }
          }
          
          resolve();
        });

        response.data.on('error', (error) => {
          reject(error);
        });
      });
    }

    const value = await parseBody(response, result);

    return value;
  } catch (error) {
    await outputError(error);
  }
};

module.exports = { req, auth };
