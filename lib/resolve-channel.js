/**
 * Resolves the active release channel and API URLs.
 *
 * TD_CHANNEL: dev | test | canary | stable   (which release channel)
 * TD_ENV:     dev | staging | production     (which infrastructure tier)
 *
 * Channel is derived from (in priority order):
 *   1. TD_CHANNEL env var (explicit override)
 *   2. TD_ENV env var — if it holds a legacy channel name (dev/test/canary/stable)
 *   3. SDK package.json version prerelease tag (e.g. "7.6.0-test.5" → "test")
 *   4. "stable" for clean semver versions
 */

const semver = require("semver");
const environments = require("./environments.json");

const CHANNELS = {
  dev: "http://localhost:1337",
  test: environments.test.apiRoot,
  canary: environments.canary.apiRoot,
  stable: environments.stable.apiRoot,
};

const VALID_ENVS = new Set(["dev", "staging", "production"]);

function resolveActiveChannel() {
  // 1. Explicit channel override
  if (process.env.TD_CHANNEL && CHANNELS[process.env.TD_CHANNEL]) {
    return process.env.TD_CHANNEL;
  }

  // 2. TD_ENV — if it holds a legacy channel name, use it as channel
  if (process.env.TD_ENV && CHANNELS[process.env.TD_ENV]) {
    return process.env.TD_ENV;
  }

  // 3. Fallback: derive from package.json prerelease tag
  const version = require("../package.json").version;
  const pre = semver.prerelease(version);
  if (pre && pre.length > 0 && CHANNELS[pre[0]]) {
    return pre[0];
  }

  return "stable";
}

const active = resolveActiveChannel();

/**
 * Returns the infrastructure environment (dev | staging | production).
 * Reads from environments.json tdEnv mapping.
 */
function resolveTdEnv() {
  // If TD_ENV is already new-format, use it directly
  if (process.env.TD_ENV && VALID_ENVS.has(process.env.TD_ENV)) {
    return process.env.TD_ENV;
  }
  // Derive from channel
  const entry = environments[active];
  return entry ? entry.tdEnv : "production";
}

const tdEnv = resolveTdEnv();

/**
 * Resolves the Sentry environment name.
 * Uses the infrastructure tier (dev | staging | production).
 */
function resolveSentryEnvironment() {
  return tdEnv;
}

const sentryEnvironment = resolveSentryEnvironment();

module.exports = { active, channels: CHANNELS, sentryEnvironment, tdEnv };
