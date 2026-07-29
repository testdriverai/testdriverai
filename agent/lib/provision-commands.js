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
 * Extract the major.minor portion of a semver-ish version string.
 *
 * Examples:
 *   '7.9.59'         -> '7.9'
 *   '7.9.59-test'    -> '7.9'
 *   '7.10.0-canary.3'-> '7.10'
 *   ''               -> ''
 *
 * @param {string} version
 * @returns {string}
 */
function majorMinor(version) {
  if (!version || typeof version !== 'string') return '';
  var m = version.match(/^(\d+)\.(\d+)/);
  return m ? m[1] + '.' + m[2] : '';
}

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
 * @param {string} [opts.sessionId] - Session ID for distributed tracing (traceId = MD5(sessionId))
 * @returns {Object} Agent config to serialize as JSON
 */
function buildAgentConfig({ sandboxId, apiRoot, apiKey, sentryDsn, sentryEnvironment, sentryChannel, ablyToken, channelName, sessionId }) {
  return {
    sandboxId,
    apiRoot,
    apiKey: apiKey || undefined,
    sentryDsn: sentryDsn || undefined,
    sentryEnvironment: sentryEnvironment || 'production',
    sentryChannel: sentryChannel || undefined,
    sessionId: sessionId || undefined,
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
 * @param {string} [opts.imageVersion] - Version baked into the AMI (skip npm install when it matches)
 * @returns {string[]} Array of PowerShell command strings
 */
function windowsProvisionCommands({ channel, configJson, sandboxId, s3DownloadUrl, imageVersion }) {
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

    // If we know the image version, check whether the baked-in runner already
    // matches — skip npm install entirely when it does (saves 5-15s per launch).
    // Only the major.minor portion is compared (patch & prerelease suffix are
    // ignored) so trivial patch bumps don't trigger an unnecessary npm install.
    // Emits a structured RUNNER_VERSION_CHECK line so SSM output / runner logs
    // capture the outcome for monitoring.
    if (imageVersion) {
      var expectedMinor = majorMinor(imageVersion);
      commands.push(
        "Write-Host 'Checking installed runner version...'",
        "$installedVersion = ''",
        "try { $pkg = Get-Content 'node_modules/@testdriverai/runner/package.json' -Raw | ConvertFrom-Json; $installedVersion = $pkg.version } catch {}",
        "$installedMinor = if ($installedVersion) { ($installedVersion -split '[.-]')[0..1] -join '.' } else { '' }",
        "if (('" + expectedMinor + "' -ne '') -and ($installedMinor -eq '" + expectedMinor + "')) {",
        "  Write-Host \"Runner already at v$installedVersion (minor " + expectedMinor + "), skipping update\"",
        "  Write-Host (\"RUNNER_VERSION_CHECK:\" + (ConvertTo-Json -Compress @{ action='skipped'; installedVersion=$installedVersion; expectedVersion='" + imageVersion + "'; expectedMinor='" + expectedMinor + "'; channel='" + channel + "'; sandboxId='" + sandboxId + "' }))",
        "} else {",
        "  Write-Host \"Installed minor: $installedMinor, expected: " + expectedMinor + " — updating...\"",
        "  Write-Host 'Installing @testdriverai/runner@" + runnerTag + "...'",
        '  npm install @testdriverai/runner@' + runnerTag + ' --omit=dev 2>&1 | Write-Host',
        "  $newVersion = ''",
        "  try { $newPkg = Get-Content 'node_modules/@testdriverai/runner/package.json' -Raw | ConvertFrom-Json; $newVersion = $newPkg.version } catch {}",
        "  Write-Host (\"RUNNER_VERSION_CHECK:\" + (ConvertTo-Json -Compress @{ action='updated'; previousVersion=$installedVersion; expectedVersion='" + imageVersion + "'; expectedMinor='" + expectedMinor + "'; newVersion=$newVersion; channel='" + channel + "'; sandboxId='" + sandboxId + "' }))",
        "  Write-Host 'Runner install complete'",
        "}"
      );
    } else {
      commands.push(
        "Write-Host 'Installing @testdriverai/runner@" + runnerTag + "...'",
        'npm install @testdriverai/runner@' + runnerTag + ' --omit=dev 2>&1 | Write-Host',
        "Write-Host 'Runner install complete'"
      );
    }
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
 * When `imageVersion` is provided with the non-S3 (npm) path, the generated
 * command checks the installed version first and skips the install when it
 * matches — mirroring the Windows version-check behaviour.
 *
 * @param {Object} opts
 * @param {string} opts.channel          - Release channel
 * @param {string} [opts.s3DownloadUrl]  - S3 pre-signed URL for dev/test
 * @param {string} [opts.runnerPath]     - Default '/opt/testdriver-runner'
 * @param {string} [opts.imageVersion]   - Version baked into the E2B template (skip install when it matches)
 * @param {string} [opts.sandboxId]      - For structured logging
 * @returns {string} Single bash command (steps joined with &&)
 */
function linuxRunnerInstallCommand({ channel, s3DownloadUrl, runnerPath, imageVersion, sandboxId }) {
  var rp = runnerPath || '/opt/testdriver-runner';
  var useS3 = (channel === 'dev' || channel === 'test') && s3DownloadUrl;
  var runnerTag = channel === 'stable' ? 'latest' : channel;
  var sid = sandboxId || 'unknown';

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

  // If we know the image version, wrap the install in a version check.
  // Only the major.minor portion is compared (patch & prerelease suffix are
  // ignored) so trivial patch bumps don't trigger an unnecessary npm install.
  if (imageVersion) {
    var expectedMinor = majorMinor(imageVersion);
    return [
      'INSTALLED_VERSION=$(node -p "try{require(\'' + rp + '/package.json\').version}catch(e){\'\'}" 2>/dev/null || echo "")',
      'INSTALLED_MINOR=$(echo "$INSTALLED_VERSION" | sed -E "s/^([0-9]+\\.[0-9]+).*/\\1/")',
      'if [ -n "' + expectedMinor + '" ] && [ "$INSTALLED_MINOR" = "' + expectedMinor + '" ]; then',
      '  echo "RUNNER_VERSION_CHECK:{\\"action\\":\\"skipped\\",\\"installedVersion\\":\\"$INSTALLED_VERSION\\",\\"expectedVersion\\":\\"' + imageVersion + '\\",\\"expectedMinor\\":\\"' + expectedMinor + '\\",\\"channel\\":\\"' + channel + '\\",\\"sandboxId\\":\\"' + sid + '\\"}"',
      '  echo "Runner already at v$INSTALLED_VERSION (minor ' + expectedMinor + '), skipping update"',
      'else',
      '  echo "Installed minor: $INSTALLED_MINOR, expected: ' + expectedMinor + ' — updating..."',
      '  sudo npm install -g @testdriverai/runner@' + runnerTag + ' --omit=dev --no-audit --no-fund --loglevel=error',
      '  sudo rm -rf ' + rp,
      '  sudo ln -sf $(npm root -g)/@testdriverai/runner ' + rp,
      '  NEW_VERSION=$(node -p "try{require(\'' + rp + '/package.json\').version}catch(e){\'\'}" 2>/dev/null || echo "")',
      '  echo "RUNNER_VERSION_CHECK:{\\"action\\":\\"updated\\",\\"previousVersion\\":\\"$INSTALLED_VERSION\\",\\"expectedVersion\\":\\"' + imageVersion + '\\",\\"expectedMinor\\":\\"' + expectedMinor + '\\",\\"newVersion\\":\\"$NEW_VERSION\\",\\"channel\\":\\"' + channel + '\\",\\"sandboxId\\":\\"' + sid + '\\"}"',
      '  echo "Runner install complete"',
      'fi',
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
  majorMinor,
};
