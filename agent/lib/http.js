/**
 * Shared HTTP client for the TestDriver SDK.
 *
 * All SDK HTTP traffic should go through these helpers so that
 * User-Agent, timeouts, Sentry tracing headers, and response
 * parsing are handled in one place.
 *
 * Uses axios under the hood — the same library the rest of the SDK
 * already depends on.
 */

const axios = require("axios");
const crypto = require("crypto");
const { version } = require("../../package.json");

const USER_AGENT = `TestDriverSDK/${version} (Node.js ${process.version})`;

/**
 * Generate Sentry distributed-tracing headers.
 *
 * When Sentry is initialized and a span is active, uses Sentry.getTraceData()
 * so the headers reference the real active span (proper parent-child linkage).
 * Falls back to MD5(sessionId)-based headers when Sentry is not available or
 * has no active span (e.g. TD_TELEMETRY=false).
 *
 * @param {string} sessionId
 * @returns {object} Headers object (empty if no sessionId and no active span)
 */
function getSentryTraceHeaders(sessionId) {
  // Prefer Sentry's own trace propagation when available
  try {
    const Sentry = require("@sentry/node");
    if (typeof Sentry.getTraceData === "function") {
      const traceData = Sentry.getTraceData();
      if (traceData && traceData["sentry-trace"]) {
        return traceData;
      }
    }
  } catch (e) {
    // Sentry not available — fall through to manual derivation
  }

  // Fallback: derive deterministic trace from session ID
  if (!sessionId) return {};
  const traceId = crypto.createHash("md5").update(sessionId).digest("hex");
  const spanId = crypto.randomBytes(8).toString("hex");
  return {
    "sentry-trace": traceId + "-" + spanId + "-1",
    baggage:
      "sentry-trace_id=" +
      traceId +
      ",sentry-sample_rate=1.0,sentry-sampled=true",
  };
}

/**
 * Build common request headers.
 * @param {object} [extra] - Additional headers to merge
 * @returns {object}
 */
function baseHeaders(extra) {
  return {
    "User-Agent": USER_AGENT,
    ...extra,
  };
}

/**
 * POST JSON to `url` and return the parsed response body.
 *
 * @param {string} url    - Absolute URL
 * @param {object} [data] - JSON body
 * @param {object} [opts] - Extra axios config (headers, timeout, …)
 * @returns {Promise<object>} Parsed response data
 */
async function httpPost(url, data, opts = {}) {
  const { headers: extraHeaders, ...rest } = opts;
  const res = await axios({
    method: "post",
    url,
    headers: baseHeaders({
      "Content-Type": "application/json",
      ...extraHeaders,
    }),
    data,
    timeout: opts.timeout || 30000,
    ...rest,
  });
  return res.data;
}

/**
 * GET `url` and return the parsed response body.
 *
 * @param {string} url    - Absolute URL
 * @param {object} [opts] - Extra axios config
 * @returns {Promise<object>} Parsed response data
 */
async function httpGet(url, opts = {}) {
  const { headers: extraHeaders, ...rest } = opts;
  const res = await axios({
    method: "get",
    url,
    headers: baseHeaders(extraHeaders),
    timeout: opts.timeout || 30000,
    ...rest,
  });
  return res.data;
}

/**
 * PUT data to `url` (e.g. S3 presigned upload).
 *
 * @param {string} url    - Absolute URL
 * @param {Buffer|string} data - Request body
 * @param {object} [opts] - Extra axios config (headers, timeout, …)
 * @returns {Promise<object>} Parsed response data (or empty object for 2xx with no body)
 */
async function httpPut(url, data, opts = {}) {
  const { headers: extraHeaders, ...rest } = opts;
  const res = await axios({
    method: "put",
    url,
    headers: baseHeaders(extraHeaders),
    data,
    timeout: opts.timeout || 30000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    ...rest,
  });
  return res.data;
}

/**
 * Download a URL as a Buffer (e.g. screenshot from S3).
 *
 * @param {string} url    - Absolute URL
 * @param {object} [opts] - Extra axios config
 * @returns {Promise<Buffer>}
 */
async function downloadBuffer(url, opts = {}) {
  const { headers: extraHeaders, ...rest } = opts;
  const res = await axios({
    method: "get",
    url,
    headers: baseHeaders(extraHeaders),
    responseType: "arraybuffer",
    timeout: opts.timeout || 60000,
    ...rest,
  });
  return Buffer.from(res.data);
}

module.exports = {
  httpPost,
  httpGet,
  httpPut,
  downloadBuffer,
  getSentryTraceHeaders,
  USER_AGENT,
  baseHeaders,
};
