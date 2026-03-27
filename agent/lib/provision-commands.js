// sdk/agent/lib/provision-commands.js
// Canonical source of truth for sandbox-agent provisioning commands.
//
// These pure functions generate platform-specific command arrays for
// installing/updating the runner, writing agent config, and starting
// the sandbox agent. They are used by:
//   - API: _provisionAgentCredentials (Windows SSM)
//   - API: _createLinuxSandbox (E2B bash)
//   - API: direct connection handler (returns commands for SDK to execute)
//   - SDK: _sendSSMCommands (direct connection, client-side SSM)
//
// Published as part of the testdriverai npm package.

'use strict';

/**
 * Build the agent config object written to the sandbox.
 *
 * @param {Object} opts
 * @param {string} opts.sandboxId
 * @param {string} opts.apiRoot
 * @param {string} [opts.apiKey]
 * @param {string} [opts.sentryDsn]
 * @param {string} [opts.sentryEnvironment]
 * @param {string} [opts.sentryChannel]
 * @param {Object} opts.ablyToken - Ably token object
 * @param {string} opts.channelName - Ably channel name
 * @returns {Object} Agent config to serialize as JSON
 */
function buildAgentConfig({ sandboxId, apiRoot, apiKey, sentryDsn, sentryEnvironment, sentryChannel, ablyToken, channelName }) {
  return {
    sandboxId,
    apiRoot,
    apiKey: apiKey || undefined,
    sentryDsn: sentryDsn || undefined,
    sentryEnvironment: sentryEnvironment || 'production',
    sentryChannel: sentryChannel || undefined,
    ably: {
      token: ablyToken,
      channel: channelName,
      // Backward compat for old runners (<=7.5.x) that expect multi-channel format
      channels: { commands: channelName, responses: channelName, control: channelName, files: channelName },
    },
  };
}

/**
 * Generate PowerShell commands to provision the sandbox agent on Windows.
 *
 * The returned array is suitable for SSM AWS-RunPowerShellScript Parameters.commands.
 *
 * @param {Object} opts
 * @param {string} opts.channel      - Release channel (dev|test|canary|stable)
 * @param {string} opts.configJson   - JSON.stringify'd agent config
 * @param {string} opts.sandboxId    - For logging
 * @param {string} [opts.s3DownloadUrl] - S3 pre-signed URL for dev/test (omit for npm install)
 * @returns {string[]} Array of PowerShell command strings
 */
function windowsProvisionCommands({ channel, configJson, sandboxId, s3DownloadUrl }) {
  var useS3 = (channel === 'dev' || channel === 'test') && s3DownloadUrl;
  var commands = [];

  // ── 1. Stop old runner ────────────────────────────────────────────
  commands.push(
    "Write-Host 'Stopping old runner...'",
    'Stop-ScheduledTask -TaskName RunTestDriverAgent -ErrorAction SilentlyContinue',
    'Stop-Process -Name node -Force -ErrorAction SilentlyContinue',
    "Remove-Item 'C:\\Windows\\Temp\\testdriver-agent.json' -Force -ErrorAction SilentlyContinue"
  );

  // ── 2. Install / update runner ────────────────────────────────────
  commands.push("Set-Location 'C:\\testdriver\\sandbox-agent'");

  var agentScript;

  if (useS3) {
    // Dev/test: download tarball from S3, extract, npm install deps
    agentScript = 'sandbox-agent.js';
    commands.push(
      "Write-Host 'Downloading runner from S3 (" + channel + ")...'",
      "$tarball = 'C:\\Windows\\Temp\\runner-dev.tgz'",
      "Invoke-WebRequest -Uri '" + s3DownloadUrl + "' -OutFile $tarball",
      "Write-Host 'Extracting runner...'",
      "tar -xzf $tarball -C 'C:\\Windows\\Temp'",
      "xcopy 'C:\\Windows\\Temp\\package\\*' 'C:\\testdriver\\sandbox-agent\\' /E /Y /I",
      "Remove-Item 'C:\\Windows\\Temp\\package' -Recurse -Force -ErrorAction SilentlyContinue",
      'Remove-Item $tarball -Force -ErrorAction SilentlyContinue',
      'npm install --omit=dev 2>&1 | Write-Host',
      "Write-Host 'Runner install complete (s3)'"
    );
  } else {
    // Canary/stable (or dev/test without S3 URL): npm install by dist-tag
    agentScript = 'node_modules/@testdriverai/runner/sandbox-agent.js';
    var runnerTag = channel === 'stable' ? 'latest' : channel;
    commands.push(
      "Write-Host 'Installing @testdriverai/runner@" + runnerTag + "...'",
      'npm install @testdriverai/runner@' + runnerTag + ' --omit=dev 2>&1 | Write-Host',
      "Write-Host 'Runner install complete'"
    );
  }

  // ── 3. Regenerate run_testdriver.ps1 ──────────────────────────────
  // Overwrites the baked-in script so the entry point matches the install layout.
  // Uses [IO.File]::WriteAllText to avoid PowerShell variable expansion issues.
  var scriptContent = [
    "Write-Output 'Starting sandbox agent...'",
    "Set-Location 'C:\\testdriver\\sandbox-agent'",
    'while ($true) {',
    '    & node ' + agentScript + ' 2>&1 | Tee-Object -Append -FilePath C:\\testdriver\\logs\\sandbox-agent.log',
    "    Write-Output 'Agent exited, restarting in 2 seconds...'",
    '    Start-Sleep -Seconds 2',
    '}',
  ].join('\r\n');

  commands.push(
    "Write-Host 'Regenerating run_testdriver.ps1...'",
    "[IO.File]::WriteAllText('C:\\testdriver\\run_testdriver.ps1', '" + scriptContent.replace(/'/g, "''") + "')"
  );

  // ── 4. Write agent config ─────────────────────────────────────────
  commands.push(
    "Write-Host '=== Writing config ==='",
    "$config = '" + configJson.replace(/'/g, "''") + "'",
    "[System.IO.File]::WriteAllText('C:\\Windows\\Temp\\testdriver-agent.json', $config)",
    "Write-Host 'Config written for sandbox " + sandboxId + "'"
  );

  // ── 5. Start runner ───────────────────────────────────────────────
  commands.push(
    'Start-Sleep -Seconds 1',
    'Start-ScheduledTask -TaskName RunTestDriverAgent',
    "Write-Host 'Runner started'"
  );

  return commands;
}

/**
 * Generate the bash command to install/update the runner on Linux (E2B).
 *
 * @param {Object} opts
 * @param {string} opts.channel        - Release channel
 * @param {string} [opts.s3DownloadUrl] - S3 pre-signed URL for dev/test
 * @param {string} [opts.runnerPath]   - Default '/opt/testdriver-runner'
 * @returns {string} Single bash command (steps joined with &&)
 */
function linuxRunnerInstallCommand({ channel, s3DownloadUrl, runnerPath }) {
  var rp = runnerPath || '/opt/testdriver-runner';
  var useS3 = (channel === 'dev' || channel === 'test') && s3DownloadUrl;
  var runnerTag = channel === 'stable' ? 'latest' : channel;

  if (useS3) {
    return [
      'sudo rm -rf ' + rp,
      'sudo mkdir -p ' + rp,
      'sudo chown -R user:user ' + rp,
      "curl -sL '" + s3DownloadUrl + "' -o /tmp/runner.tgz",
      'tar -xzf /tmp/runner.tgz -C /tmp',
      'cp -r /tmp/package/* ' + rp + '/',
      'rm -rf /tmp/runner.tgz /tmp/package',
      'cd ' + rp + ' && npm install --omit=dev --no-audit --no-fund --loglevel=error',
    ].join(' && ');
  }

  return [
    'sudo npm install -g @testdriverai/runner@' + runnerTag + ' --omit=dev --no-audit --no-fund --loglevel=error',
    'sudo rm -rf ' + rp,
    'sudo ln -sf $(npm root -g)/@testdriverai/runner ' + rp,
  ].join(' && ');
}

module.exports = {
  buildAgentConfig,
  windowsProvisionCommands,
  linuxRunnerInstallCommand,
};
