const config = require("./config");
const session = require("./session");

// get the version from package.json
const { version } = require("../package.json");
const root = config["TD_API_ROOT"];
const axios = require("axios");
const theme = require("./theme");

const { logger } = require("./logger");

let token = null;

const outputError = (error) => {
  logger.error(
    "API Error: %s (%s)",
    theme.red(
      // HTTP status code from Axios
      error.status ||
        // ...or an explicit error `reason` set by Sails
        error.reason ||
        // ...or default to the error message
        error.message,
    ),
    theme.red(
      // e.g. "teamNotExist" from Sails' exits
      error.response?.data?.raw ||
        // ...or the status text
        error.statusText ||
        // ...or the HTTP status code
        error.code,
    ),
  );
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
    logger.error(theme.red("Parsing Error", err));
    throw err;
  }
};

let auth = async () => {
  if (config["TD_API_KEY"]) {
    const url = [root, "auth/exchange-api-key"].join("/");
    const c = {
      method: "post",
      headers: {
        "Content-Type": "application/json",
      },
      data: {
        apiKey: config["TD_API_KEY"],
        version,
      },
    };

    try {
      let res = await axios(url, c);

      token = res.data.token;
      return token;
    } catch (error) {
      outputError(error);
      process.exit(1);
    }
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

  const c = {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }), // Add the authorization bearer token only if token is set
    },
    responseType: typeof onChunk === "function" ? "stream" : "json",
    data: {
      ...data,
      session: session.get(),
      stream: typeof onChunk === "function",
    },
  };

  try {
    let response;

    response = await axios(url, c);

    const contentType = response.headers["content-type"]?.toLowerCase();
    const isJsonl = contentType === "application/jsonl";
    let result;

    if (onChunk) {
      result = "";
      let lastLineIndex = -1;

      await new Promise((resolve, reject) => {
        // theres some kind of race condition here that makes things resolve
        // before the stream is done

        response.data.on("data", (chunk) => {
          result += chunk.toString();
          const lines = result.split("\n");
          const events = lines
            .slice(lastLineIndex + 1, lines.length - 1)
            .filter((line) => {
              return line.length;
            })
            .map((line) => {
              return JSON.parse(line);
            });

          for (const event of events) {
            onChunk(event);
          }

          lastLineIndex = lines.length - 2;
        });

        response.data.on("end", () => {
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

        response.data.on("error", (error) => {
          reject(error);
        });
      });
    }

    const value = await parseBody(response, result);

    return value;
  } catch (error) {
    outputError(error);
  }
};

module.exports = { req, auth };
