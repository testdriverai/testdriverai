/**
 * Resolves the active release channel and API URLs.
 *
 * Channel is derived from (in priority order):
 *   1. TD_CHANNEL env var (explicit override)
 *   2. TD_ENV env var (set by envs/<name>.env)
 *   3. SDK package.json version prerelease tag (e.g. "7.6.0-test.5" → "test")
 *   4. "latest" for clean semver versions (stable releases)
 */

const semver = require("semver");
const environments = require("./environments.json");

const CHANNELS = {
  dev: "http://localhost:1337",
  test: environments.test.apiRoot,
  canary: environments.canary.apiRoot,
  latest: environments.stable.apiRoot,
};

function resolveActiveChannel() {
  // 1. Explicit channel override
  if (process.env.TD_CHANNEL && CHANNELS[process.env.TD_CHANNEL]) {
    return process.env.TD_CHANNEL;
  }

  // 2. Environment name from env file (mapped: stable → latest)
  if (process.env.TD_ENV) {
    const envName = process.env.TD_ENV;
    if (CHANNELS[envName]) return envName;
    if (envName === "stable") return "latest";
  }

  // 3. Fallback: derive from package.json prerelease tag
  const version = require("../package.json").version;
  const pre = semver.prerelease(version);
  if (pre && pre.length > 0 && CHANNELS[pre[0]]) {
    return pre[0];
  }

  return "latest";
}

const active = resolveActiveChannel();

module.exports = { active, channels: CHANNELS };
