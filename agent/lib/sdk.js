const { events } = require("../events");
const { getSentryTraceHeaders } = require("./http");

// get the version from package.json
const { version } = require("../../package.json");
const axios = require("axios");

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 10,
  baseDelayMs: 3000,
  maxDelayMs: 30000,
  // Error codes that should trigger a retry
  retryableNetworkCodes: [
    'ECONNRESET',
    'ECONNREFUSED', 
    'ETIMEDOUT',
    'ENOTFOUND',
    'ENETUNREACH',
    'ERR_NETWORK',
    'ECONNABORTED',
    'EPIPE',
    'EAI_AGAIN',
  ],
  // HTTP status codes that should trigger a retry
  retryableStatusCodes: [429, 500, 502, 503, 504],
};

/**
 * Determines if an error is retryable
 * @param {Error} error - The axios error
 * @param {Object} config - Retry configuration
 * @returns {boolean} Whether the request should be retried
 */
function isRetryableError(error, config = DEFAULT_RETRY_CONFIG) {
  // Network-level errors (no response received)
  if (!error.response) {
    return config.retryableNetworkCodes.includes(error.code);
  }
  
  // HTTP status code based retries
  const status = error.response?.status;
  return config.retryableStatusCodes.includes(status);
}

/**
 * Calculate delay for next retry using exponential backoff with jitter
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {Error} error - The error that triggered the retry
 * @param {Object} config - Retry configuration
 * @returns {number} Delay in milliseconds
 */
function calculateRetryDelay(attempt, error, config = DEFAULT_RETRY_CONFIG) {
  // Respect Retry-After header for rate limiting
  if (error.response?.status === 429) {
    const retryAfter = error.response.headers?.['retry-after'];
    if (retryAfter) {
      const retryAfterMs = parseInt(retryAfter, 10) * 1000;
      if (!isNaN(retryAfterMs) && retryAfterMs > 0) {
        return Math.min(retryAfterMs, config.maxDelayMs);
      }
    }
  }
  
  // Exponential backoff: baseDelay * 2^attempt + random jitter
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * config.baseDelayMs * 0.5;
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Execute an async function with retry logic
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Options
 * @param {Object} options.retryConfig - Retry configuration (uses defaults if not provided)
 * @param {Function} options.onRetry - Callback called before each retry (attempt, error, delayMs)
 * @returns {Promise<*>} Result of the function
 */
async function withRetry(fn, options = {}) {
  const config = { ...DEFAULT_RETRY_CONFIG, ...options.retryConfig };
  let lastError;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if we've exhausted attempts or error isn't retryable
      if (attempt >= config.maxRetries || !isRetryableError(error, config)) {
        throw error;
      }
      
      const delayMs = calculateRetryDelay(attempt, error, config);
      
      // Call onRetry callback if provided
      if (options.onRetry) {
        options.onRetry(attempt + 1, error, delayMs);
      }
      
      await sleep(delayMs);
    }
  }
  
  throw lastError;
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
    if (!config["TD_API_KEY"]) {
      const error = new Error(
        "TD_API_KEY is not configured. Get your API key at https://console.testdriver.ai/team"
      );
      error.code = "MISSING_API_KEY";
      error.isAuthError = true;
      throw error;
    }

    const url = [config["TD_API_ROOT"], "auth/exchange-api-key"].join("/");
    const c = {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": `TestDriverSDK/${version} (Node.js ${process.version})`,
      },
      timeout: 15000, // 15 second timeout for auth requests
      data: {
        apiKey: config["TD_API_KEY"],
        version,
      },
    };

    try {
      let res = await withRetry(
        () => axios(url, c),
        {
          retryConfig: { maxRetries: 2 },
          onRetry: (attempt, error, delayMs) => {
            emitter.emit(events.sdk.retry, {
              path: 'auth/exchange-api-key',
              attempt,
              error: error.message || error.code,
              delayMs,
            });
          },
        }
      );

      token = res.data.token;
      return token;
    } catch (error) {
      // Classify the error for better user feedback
      const classifiedError = classifyAuthError(error, config["TD_API_ROOT"]);
      outputError(classifiedError);
      throw classifiedError;
    }
  };

  /**
   * Classify authentication errors into user-friendly categories
   * @param {Error} error - The original axios error
   * @param {string} apiRoot - The API root URL for context
   * @returns {Error} A classified error with code and helpful message
   */
  function classifyAuthError(error, apiRoot) {
    const status = error.response?.status;
    const data = error.response?.data;

    // Check for network-level errors (no response received)
    if (!error.response) {
      const networkError = new Error(
        `Unable to reach TestDriver API at ${apiRoot}. ` +
        getNetworkErrorHint(error.code)
      );
      networkError.code = "NETWORK_ERROR";
      networkError.isNetworkError = true;
      networkError.originalError = error;
      return networkError;
    }

    // Invalid API key (401)
    if (status === 401) {
      const authError = new Error(
        data?.message ||
        "Invalid API key. Please check your TD_API_KEY and try again. " +
        "Get your API key at https://console.testdriver.ai/team"
      );
      authError.code = data?.error || "INVALID_API_KEY";
      authError.isAuthError = true;
      authError.originalError = error;
      return authError;
    }

    // Server errors (5xx) - API is down or having issues
    if (status >= 500) {
      const serverError = new Error(
        data?.message ||
        `An error occurred on the TestDriver server (HTTP ${status}). Please try again later.`
      );
      serverError.code = data?.error || "SERVER_ERROR";
      serverError.isServerError = true;
      serverError.originalError = error;
      return serverError;
    }

    // Rate limiting (429)
    if (status === 429) {
      const rateLimitError = new Error(
        "Too many requests to TestDriver API. Please wait a moment and try again."
      );
      rateLimitError.code = "RATE_LIMITED";
      rateLimitError.isRateLimitError = true;
      rateLimitError.originalError = error;
      return rateLimitError;
    }

    // Forbidden (403) - likely Cloudflare or WAF blocking the request
    if (status === 403) {
      const forbiddenError = new Error(
        "Request blocked (HTTP 403). This may be caused by a firewall or bot protection. " +
        "If this persists, please contact support."
      );
      forbiddenError.code = "REQUEST_BLOCKED";
      forbiddenError.isForbiddenError = true;
      forbiddenError.originalError = error;
      return forbiddenError;
    }

    // Other HTTP errors - return with context
    const url = error.config?.url || apiRoot;
    const genericError = new Error(
      `Authentication failed: ${status} ${error.response?.statusText || "Unknown error"} (${url})`
    );
    genericError.code = "AUTH_FAILED";
    genericError.originalError = error;
    return genericError;
  }

  /**
   * Get a helpful hint based on the network error code
   * @param {string} code - The error code (ECONNREFUSED, ETIMEDOUT, etc.)
   * @returns {string} A helpful message for the user
   */
  function getNetworkErrorHint(code) {
    const hints = {
      ECONNREFUSED: "The server refused the connection. Check if the API is running.",
      ETIMEDOUT: "The connection timed out. Check your internet connection.",
      ENOTFOUND: "Could not resolve the hostname. Check your internet connection or DNS settings.",
      ENETUNREACH: "Network is unreachable. Check your internet connection.",
      ECONNRESET: "Connection was reset. This may be a temporary network issue.",
      ERR_NETWORK: "A network error occurred. Check your internet connection.",
      ECONNABORTED: "The request was aborted due to a timeout.",
    };
    return hints[code] || "Check your internet connection and try again.";
  }

  const req = async (path, data, onChunk) => {
    // for each value of data, if it is null/undefined remove it
    // Note: use == null to match both null and undefined, but preserve
    // other falsy values like 0, false, and "" which may be intentional
    for (let key in data) {
      if (data[key] == null) {
        delete data[key];
      }
    }

    // ── S3 upload: replace large inline base64 images with S3 keys ──────
    // If data.image is a large base64 string (>50KB), upload the raw PNG
    // to S3 via a presigned URL and send only the imageKey instead.
    // This reduces JSON body size from ~1.3MB to ~60 bytes.
    const MIN_IMAGE_SIZE = 50_000; // 50KB base64 chars
    if (
      data &&
      typeof data.image === "string" &&
      data.image.length > MIN_IMAGE_SIZE
    ) {
      try {
        const apiRoot = config["TD_API_ROOT"];
        const uploadUrlEndpoint = [apiRoot, "api", version, "testdriver", "upload-url"].join("/");

        // Step 1: Get presigned upload URL from API
        const uploadRes = await axios(uploadUrlEndpoint, {
          method: "post",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": `TestDriverSDK/${version} (Node.js ${process.version})`,
            ...(token && { Authorization: `Bearer ${token}` }),
            ...getSentryTraceHeaders(sessionInstance.get()),
          },
          timeout: 15000,
          data: {
            session: sessionInstance.get(),
            contentType: "image/png",
          },
        });

        const { uploadUrl, imageKey } = uploadRes.data;

        if (uploadUrl && imageKey) {
          // Step 2: Upload raw PNG bytes to S3 via presigned PUT URL
          const base64Data = data.image.replace(/^data:image\/\w+;base64,/, "");
          const pngBuffer = Buffer.from(base64Data, "base64");

          await axios(uploadUrl, {
            method: "put",
            headers: {
              "Content-Type": "image/png",
              "Content-Length": pngBuffer.length,
            },
            data: pngBuffer,
            timeout: 30000,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
          });

          // Step 3: Replace image with imageKey in the request data
          const savedKB = (data.image.length / 1024).toFixed(0);
          delete data.image;
          data.imageKey = imageKey;
          emitter.emit(events.log?.debug || events.sdk.request, {
            path,
            message: `[sdk] uploaded screenshot to S3 (saved ${savedKB}KB inline), imageKey=${imageKey}`,
          });
        }
      } catch (uploadErr) {
        // Non-fatal: fall back to sending base64 inline
        // This ensures old API servers without the upload-url endpoint still work
        emitter.emit(events.log?.debug || events.sdk.request, {
          path,
          message: `[sdk] S3 upload failed, falling back to inline base64: ${uploadErr.message}`,
        });
      }
    }
    // ── End S3 upload ───────────────────────────────────────────────────

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
        "User-Agent": `TestDriverSDK/${version} (Node.js ${process.version})`,
        ...(token && { Authorization: `Bearer ${token}` }), // Add the authorization bearer token only if token is set
        ...sentryHeaders, // Add Sentry distributed tracing headers
      },
      responseType: typeof onChunk === "function" ? "stream" : "json",
      timeout: 120000, // 120 second timeout to prevent hanging requests
      data: {
        ...data,
        session: sessionInstance.get(),
        stream: typeof onChunk === "function",
      },
    };

    try {
      let response;

      // Use retry logic for non-streaming requests
      // Streaming requests are not retried as they involve ongoing data transfer
      if (typeof onChunk !== "function") {
        response = await withRetry(
          () => axios(url, c),
          {
            onRetry: (attempt, error, delayMs) => {
              emitter.emit(events.sdk.retry, {
                path,
                attempt,
                error: error.message || error.code,
                delayMs,
              });
            },
          }
        );
      } else {
        response = await axios(url, c);
      }

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
      // Check for network-level errors (no response received)
      if (!error.response) {
        const networkError = new Error(
          `Unable to reach TestDriver API at ${config["TD_API_ROOT"]}. ` +
          getNetworkErrorHint(error.code)
        );
        networkError.code = "NETWORK_ERROR";
        networkError.isNetworkError = true;
        networkError.originalError = error;
        networkError.path = path;
        
        emitter.emit(events.error.sdk, {
          message: networkError.message,
          code: networkError.code,
          fullError: error,
        });
        
        throw networkError;
      }

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

      // Server errors (5xx) - API is down or having issues
      const status = error.response?.status;
      if (status >= 500) {
        const serverError = new Error(
          error.response?.data?.message ||
          `An error occurred on the TestDriver server (HTTP ${status}). Please try again later.`
        );
        serverError.code = error.response?.data?.error || "SERVER_ERROR";
        serverError.isServerError = true;
        serverError.originalError = error;
        serverError.path = path;
        
        emitter.emit(events.error.sdk, {
          message: serverError.message,
          code: serverError.code,
          fullError: error,
        });
        
        throw serverError;
      }

      // Rate limiting (429)
      if (status === 429) {
        const rateLimitError = new Error(
          "Too many requests to TestDriver API. Please wait a moment and try again."
        );
        rateLimitError.code = "RATE_LIMITED";
        rateLimitError.isRateLimitError = true;
        rateLimitError.originalError = error;
        rateLimitError.path = path;
        
        emitter.emit(events.error.sdk, {
          message: rateLimitError.message,
          code: rateLimitError.code,
          fullError: error,
        });
        
        throw rateLimitError;
      }
      
      outputError(error);
      throw error; // Re-throw the error so calling code can handle it properly
    }
  };

  return { req, auth };
};

// Export the factory function and shared utilities
module.exports = { createSDK, withRetry, getSentryTraceHeaders, sleep };
