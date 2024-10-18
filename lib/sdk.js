const config = require("./config");
const chalk = require("chalk");
const session = require("./session");
const package = require("../package.json");
const version = package.version;

const root = config["TD_API_ROOT"];
const shouldStream = config["TD_STREAM_RESPONSES"];

// let token = null;

const outputError = async (error) => {
  if (error instanceof Response) {
    console.log(chalk.red(error.status), chalk.red(error.statusText));
    await parseBody(error)
      .then((body) => console.log(chalk.red(body)))
      .catch(() => {});
  } else {
    console.error("Error:", error);
  }
};

const parseBody = async (response, body) => {
  const contentType = response.headers.get("Content-Type")?.toLowerCase();
  try {
    if (body === null || body === undefined) {
      if (!contentType.includes("json") && !contentType.includes("text")) {
        return await response.arrayBuffer();
      }
      if (contentType.includes("json")) {
        return await response.json();
      }
      return await response.text();
    }
    if (typeof body === "string" && contentType.includes("json")) {
      return JSON.parse(body);
    }
    return body;
  } catch (err) {
    console.log(chalk.red("Parsing Error", err));
    throw err;
  }
};

let auth = async () => {
  // data.apiKey = process.env.DASHCAM_API_KEY; @todo add-auth

  // if (!data.apiKey) {
  //   console.log(chalk.red('API key not found. Set DASHCAM_API_KEY in your environment.'));
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
    await fetch(url, config);
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
    : [root, "api", "v" + version, "testdriver", path].join("/");

  const config = {
    method: "post",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...data,
      session: session.get()?.id,
      stream: typeof onChunk === "function",
    }),
  };

  try {
    const response = await fetch(url, config);
    if (response.status === 301) {
      const redirectUrl = await response.text();
      return req(redirectUrl, data, onChunk);
    }
    if (response.status >= 300) {
      throw response;
    }

    let result;
    if (onChunk) {
      result = "";
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = new TextDecoder().decode(value);
        result += chunk;
        if (shouldStream) {
          await onChunk(chunk);
        }
      }
      if (!shouldStream) {
        await onChunk(result);
      }
    }

    return parseBody(response, result);
  } catch (error) {
    await outputError(error);
  }
};

module.exports = { req, auth };
