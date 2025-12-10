const { events } = require("../events");
const crypto = require("crypto");

// get the version from package.json
const { version } = require("../../package.json");
const axios = require("axios");

/**
 * Generate Sentry trace headers for distributed tracing
 * Uses the same trace ID derivation as the API (MD5 hash of session ID)
 * @param {string} sessionId - The session ID
 * @returns {Object} Headers object with sentry-trace and baggage
 */
function getSentryTraceHeaders(sessionId) {
  if (!sessionId) return {};
  
  // Same logic as API: derive trace ID from session ID
  const traceId = crypto.createHash('md5').update(sessionId).digest('hex');
  const spanId = crypto.randomBytes(8).toString('hex');
  
  return {
    'sentry-trace': `${traceId}-${spanId}-1`,
    'baggage': `sentry-trace_id=${traceId},sentry-sample_rate=1.0,sentry-sampled=true`
  };
}

// Factory function that creates SDK with the provided emitter, config, and session
let token = null;
const createSDK = (emitter, config, sessionInstance) => {
  // Config is required - no fallback to avoid process.env usage
  if (!config) {
    throw new Error("Config must be provided to createSDK");
  }

  // Session is required
  if (!sessionInstance) {
    throw new Error("Session instance must be provided to createSDK");
  }

  const outputError = (error) => {
    emitter.emit(events.error.sdk, {
      message: error.status || error.reason || error.message,
      code: error.response?.data?.raw || error.statusText || error.code,
      fullError: error,
    });
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
      emitter.emit(events.error.sdk, {
        error: err,
        message: "Parsing Error",
      });
      throw err;
    }
  };

  const auth = async () => {
    if (config["TD_API_KEY"]) {
      const url = [config["TD_API_ROOT"], "auth/exchange-api-key"].join("/");
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
        throw error; // Re-throw the error so calling code can handle it properly
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

    emitter.emit(events.sdk.request, {
      path,
    });

    const url = path.startsWith("/api")
      ? [config["TD_API_ROOT"], path].join("")
      : [config["TD_API_ROOT"], "api", version, "testdriver", path].join("/");

    // Get session ID for Sentry trace headers
    const sessionId = sessionInstance.get();
    const sentryHeaders = getSentryTraceHeaders(sessionId);

    const c = {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }), // Add the authorization bearer token only if token is set
        ...sentryHeaders, // Add Sentry distributed tracing headers
      },
      responseType: typeof onChunk === "function" ? "stream" : "json",
      timeout: 60000, // 60 second timeout to prevent hanging requests
      data: {
        ...data,
        session: sessionInstance.get(),
        stream: typeof onChunk === "function",
      },
    };

    console.log("SDK REQ:", url, c);

    try {
      let response;

      response = await axios(url, c);

      emitter.emit(events.sdk.response, {
        path,
      });

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
              .filter((line) => line.length)
              .map((line) => JSON.parse(line));

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
      // Check if this is an API validation error with detailed problems
      if (error.response?.data?.problems) {
        const problems = error.response.data.problems;
        const errorMessage = error.response.data.message || 'API validation error';
        const detailedError = new Error(
          `${errorMessage}\n\nDetails:\n${problems.map(p => `  - ${p}`).join('\n')}`
        );
        detailedError.originalError = error;
        detailedError.problems = problems;
        
        // Emit the formatted error
        emitter.emit(events.error.sdk, {
          message: detailedError.message,
          code: error.response?.data?.code || error.code,
          problems: problems,
          fullError: error,
        });
        
        throw detailedError;
      }
      
      outputError(error);
      throw error; // Re-throw the error so calling code can handle it properly
    }
  };

  return { req, auth };
};

// Export the factory function
module.exports = { createSDK };
