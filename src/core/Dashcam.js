/**
 * Dashcam Class
 * Manages Dashcam CLI recording lifecycle
 * 
 * Provides a clean interface for:
 * - Authentication
 * - Log tracking
 * - Starting/stopping recordings
 * - Retrieving replay URLs
 */

class Dashcam {
  /**
   * Create a Dashcam instance
   * @param {Object} client - TestDriver client instance
   * @param {Object} options - Configuration options
   * @param {string} [options.apiKey] - Dashcam API key
   * @param {boolean} [options.autoStart=false] - Auto-start recording
   * @param {Array} [options.logs=[]] - Log configurations to add
   */
  constructor(client, options = {}) {
    if (!client) {
      throw new Error('Dashcam requires a TestDriver client instance');
    }
    
    this.client = client;
    // Use provided apiKey, or client's apiKey, or fallback to a default
    this.apiKey = options.apiKey || client.apiKey || client.config?.TD_API_KEY || '4e93d8bf-3886-4d26-a144-116c4063522d';
    this.autoStart = options.autoStart ?? false;
    this.logs = options.logs || [];
    this.recording = false;
    this._authenticated = false;
    this.startTime = null; // Track when dashcam recording started
  }

  /**
   * Get shell type based on client OS
   * @private
   */
  _getShell() {
    return this.client.os === 'windows' ? 'pwsh' : 'sh';
  }

  /**
   * Get TD_API_ROOT from client config
   * @private
   */
  _getApiRoot() {
    return this.client.config?.TD_API_ROOT || 'http://localhost:1337';
  }

  /**
   * Get dashcam executable path
   * @private
   */
  async _getDashcamPath() {
    const shell = this._getShell();
    const npmPrefix = await this.client.exec(shell, 'npm prefix -g', 40000, true);
    
    if (this.client.os === 'windows') {
      return npmPrefix.trim() + '\\dashcam.cmd';
    }
    return npmPrefix.trim() + '/bin/dashcam';
  }

  /**
   * Authenticate dashcam with API key
   * @param {string} [apiKey] - Override API key
   * @returns {Promise<void>}
   */
  async auth(apiKey) {
    const key = apiKey || this.apiKey;
    const shell = this._getShell();
    const apiRoot = this._getApiRoot();

    if (this.client.os === 'windows') {
      // Debug session info
      const debug = await this.client.exec(shell, 'query session', 40000, true);
      this._log('debug', 'Debug version output:', debug);

      // Uninstall and clear cache for fresh install
      await this.client.exec(shell, 'npm uninstall dashcam -g', 40000, true);
      await this.client.exec(shell, 'npm cache clean --force', 40000, true);
      
      // Install dashcam with TD_API_ROOT environment variable
      const installOutput = await this.client.exec(
        shell,
        `$env:TD_API_ROOT="${apiRoot}"; npm install dashcam@beta -g`,
        120000,
        true
      );
      this._log('debug', 'Install dashcam output:', installOutput);

      // Verify version
      const latestVersion = await this.client.exec(
        shell,
        'npm view dashcam@beta version',
        40000,
        true
      );
      this._log('debug', 'Latest beta version available:', latestVersion);
      
      const dashcamPath = await this._getDashcamPath();
      this._log('debug', 'Dashcam executable path:', dashcamPath);
      
      const installedVersion = await this.client.exec(
        shell,
        'npm ls dashcam -g',
        40000,
        true
      );
      this._log('debug', 'Installed dashcam version:', installedVersion);
      
      // Test version command
      const versionTest = await this.client.exec(
        shell,
        `& "${dashcamPath}" version`,
        40000,
        true
      );
      this._log('debug', 'Dashcam version test:', versionTest);
      
      // Verify installation
      if (!installedVersion) {
        this._log('error', 'Dashcam version command returned null/empty');
        this._log('debug', 'Install output was:', installOutput);
      } else if (!installedVersion.includes('1.3.')) {
        this._log('warn', 'Dashcam version may be outdated. Expected 1.3.x, got:', installedVersion);
      } else {
        this._log('debug', 'Dashcam version verified:', installedVersion);
      }

      // Authenticate with TD_API_ROOT
      const authOutput = await this.client.exec(
        shell,
        `$env:TD_API_ROOT="${apiRoot}"; & "${dashcamPath}" auth ${key}`,
        120000,
        true
      );
      this._log('debug', 'Auth output:', authOutput);
    } else {
      // Linux/Mac authentication with TD_API_ROOT
      const authOutput = await this.client.exec(
        shell,
        `TD_API_ROOT="${apiRoot}" dashcam auth ${key}`,
        120000,
        true
      );
      this._log('debug', 'Auth output:', authOutput);
    }

    this._authenticated = true;
  }

  /**
   * Add file log tracking
   * @param {string} path - Path to log file
   * @param {string} name - Display name
   * @returns {Promise<void>}
   */
  async addFileLog(path, name) {
    const shell = this._getShell();
    const apiRoot = this._getApiRoot();

    if (this.client.os === 'windows') {
      // Create log file if it doesn't exist
      const createFileOutput = await this.client.exec(
        shell,
        `New-Item -ItemType File -Path "${path}" -Force`,
        10000,
        true
      );
      this._log('debug', 'Create log file output:', createFileOutput);

      const dashcamPath = await this._getDashcamPath();
      const addLogOutput = await this.client.exec(
        shell,
        `$env:TD_API_ROOT="${apiRoot}"; & "${dashcamPath}" logs --add --type=file --file="${path}" --name="${name}"`,
        120000,
        true
      );
      this._log('debug', 'Add log tracking output:', addLogOutput);
    } else {
      // Create log file
      await this.client.exec(shell, `touch ${path}`, 10000, true);

      // Add log tracking with TD_API_ROOT
      const addLogOutput = await this.client.exec(
        shell,
        `TD_API_ROOT="${apiRoot}" dashcam logs --add --type=file --file="${path}" --name="${name}"`,
        10000,
        true
      );
      this._log('debug', 'Add log tracking output:', addLogOutput);
    }
  }

  /**
   * Add application log tracking
   * @param {string} application - Application name
   * @param {string} name - Display name
   * @returns {Promise<void>}
   */
  async addApplicationLog(application, name) {
    const shell = this._getShell();
    const dashcamPath = await this._getDashcamPath();
    const apiRoot = this._getApiRoot();

    if (this.client.os === 'windows') {
      const addLogOutput = await this.client.exec(
        shell,
        `$env:TD_API_ROOT="${apiRoot}"; & "${dashcamPath}" logs --add --type=application --application="${application}" --name="${name}"`,
        120000,
        true
      );
      this._log('debug', 'Add application log tracking output:', addLogOutput);
    } else {
      const addLogOutput = await this.client.exec(
        shell,
        `TD_API_ROOT="${apiRoot}" dashcam logs --add --type=application --application="${application}" --name="${name}"`,
        10000,
        true
      );
      this._log('debug', 'Add application log tracking output:', addLogOutput);
    }
  }

  /**
   * Add web log tracking
   * @param {string} pattern - URL pattern to match (e.g., "*example.com*")
   * @param {string} name - Display name
   * @returns {Promise<void>}
   */
  async addWebLog(pattern, name) {
    const shell = this._getShell();
    const dashcamPath = await this._getDashcamPath();
    const apiRoot = this._getApiRoot();

    if (this.client.os === 'windows') {
      const addLogOutput = await this.client.exec(
        shell,
        `$env:TD_API_ROOT="${apiRoot}"; & "${dashcamPath}" logs --add --type=web --pattern="${pattern}" --name="${name}"`,
        120000,
        true
      );
      this._log('debug', 'Add web log tracking output:', addLogOutput);
    } else {
      const addLogOutput = await this.client.exec(
        shell,
        `TD_API_ROOT="${apiRoot}" dashcam logs --add --type=web --pattern="${pattern}" --name="${name}"`,
        10000,
        true
      );
      this._log('debug', 'Add web log tracking output:', addLogOutput);
    }
  }

  /**
   * Start dashcam recording
   * @returns {Promise<void>}
   */
  async start() {
    if (this.recording) {
      this._log('warn', 'Dashcam already recording');
      return;
    }

    // Auto-authenticate if not already done
    if (!this._authenticated) {
      this._log('info', 'Auto-authenticating dashcam...');
      await this.auth();
    }

    const shell = this._getShell();
    const apiRoot = this._getApiRoot();

    if (this.client.os === 'windows') {
      this._log('info', 'Starting dashcam recording on Windows...');
      
      const dashcamPath = await this._getDashcamPath();
      this._log('debug', 'Dashcam path:', dashcamPath);
      
      // Verify dashcam exists
      const dashcamExists = await this.client.exec(
        shell,
        `Test-Path "${dashcamPath}"`,
        10000,
        true
      );
      this._log('debug', 'Dashcam.cmd exists:', dashcamExists);
      
      // Start dashcam record and redirect output with TD_API_ROOT
      const outputFile = 'C:\\Users\\testdriver\\.dashcam-cli\\dashcam-start.log';
      const startScript = `
        try {
          $env:TD_API_ROOT="${apiRoot}"
          $process = Start-Process "cmd.exe" -ArgumentList "/c", "${dashcamPath} record > ${outputFile} 2>&1" -PassThru
          Write-Output "Process started with PID: $($process.Id)"
          Start-Sleep -Seconds 2
          if ($process.HasExited) {
            Write-Output "Process has already exited with code: $($process.ExitCode)"
          } else {
            Write-Output "Process is still running"
          }
        } catch {
          Write-Output "ERROR: $_"
        }
      `;
      
      const startOutput = await this.client.exec(shell, startScript, 10000, true);
      this._log('debug', 'Start-Process output:', startOutput);
      
      // Wait and check output
      await new Promise(resolve => setTimeout(resolve, 2000));
      const dashcamOutput = await this.client.exec(
        shell,
        `Get-Content "${outputFile}" -ErrorAction SilentlyContinue`,
        10000,
        true
      );
      this._log('debug', 'Dashcam record output:', dashcamOutput);
      
      // Give process time to initialize
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      this._log('info', 'Dashcam recording started');
    } else {
      // Linux/Mac with TD_API_ROOT
      this._log('info', 'Starting dashcam recording on Linux/Mac...');
      await this.client.exec(shell, `TD_API_ROOT="${apiRoot}" dashcam record >/dev/null 2>&1 &`);
      this._log('info', 'Dashcam recording started');
    }

    this.recording = true;
    this.startTime = Date.now(); // Record the timestamp when dashcam started

    // Update the session with dashcam start time for interaction timestamp synchronization
    if (this.client && this.client.agent && this.client.agent.session) {
      try {
        const apiRoot = this.apiRoot || process.env.TD_API_ROOT || 'https://app.testdriver.ai';
        const response = await fetch(`${apiRoot}/api/v7.0.0/testdriver/session/${this.client.agent.session}/update-dashcam-time`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({ dashcamStartTime: this.startTime })
        });

        if (response.ok) {
          this._log('info', `Updated session ${this.client.agent.session} with dashcam start time: ${this.startTime}`);
        } else {
          this._log('warn', 'Failed to update session with dashcam start time:', response.statusText);
        }
      } catch (err) {
        this._log('warn', 'Error updating session with dashcam start time:', err.message);
      }
    }
  }

  /**
   * Stop dashcam recording and retrieve replay URL
   * @returns {Promise<string|null>} Replay URL if available
   */
  async stop() {
    if (!this.recording) {
      // Internal log only - don't spam user console
      this._log('warn', 'Dashcam not recording');
      return null;
    }

    this._log('info', 'Stopping dashcam and retrieving URL...');
    const shell = this._getShell();
    const apiRoot = this._getApiRoot();
    let output;

    if (this.client.os === 'windows') {
      this._log('info', 'Stopping dashcam process on Windows...');
      
      const dashcamPath = await this._getDashcamPath();
      
      // Stop and get output with TD_API_ROOT
      output = await this.client.exec(shell, `$env:TD_API_ROOT="${apiRoot}"; & "${dashcamPath}" stop`, 120000);
      this._log('debug', 'Dashcam stop command output:', output);
    } else {
      // Linux/Mac with TD_API_ROOT
      const dashcamPath = await this._getDashcamPath();
      output = await this.client.exec(shell, `TD_API_ROOT="${apiRoot}" "${dashcamPath}" stop`, 60000, false);
      this._log('debug', 'Dashcam command output:', output);
    }

    this.recording = false;

    // Extract URL from output
    if (output) {
      // Look for replay URL with optional query parameters (most specific)
      // Matches: http://localhost:3001/replay/abc123?share=xyz or https://app.dashcam.io/replay/abc123
      const replayUrlMatch = output.match(/https?:\/\/[^\s"',}]+\/replay\/[^\s"',}]+/);
      if (replayUrlMatch) {
        let url = replayUrlMatch[0];
        // Remove trailing punctuation but keep query params
        url = url.replace(/[.,;:!\)\]]+$/, '').trim();
        this._log('info', 'Found dashcam URL:', url);
        return url;
      }
      
      // Fallback: any dashcam.io or testdriver.ai URL
      const dashcamUrlMatch = output.match(/https?:\/\/(?:app\.)?(?:dashcam\.io|testdriver\.ai)[^\s"',}]+/);
      if (dashcamUrlMatch) {
        let url = dashcamUrlMatch[0];
        url = url.replace(/[.,;:!\?\)\]]+$/, '').trim();
        this._log('info', 'Found dashcam URL:', url);
        return url;
      }
      
      this._log('warn', 'No replay URL found in dashcam output');
    } else {
      this._log('warn', 'Dashcam command returned no output');
    }

    return null;
  }

  /**
   * Internal logging - writes to testdriver log file but not user console
   * @private
   */
  _log(level, ...args) {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [DASHCAM:${level.toUpperCase()}] ${message}`;
    
    // Send to sandbox log file via output command (same as console interceptor)
    if (this.client?.sandbox?.instanceSocketConnected) {
      try {
        this.client.sandbox.send({
          type: "output",
          output: Buffer.from(logLine, "utf8").toString("base64"),
        });
      } catch {
        // Silently fail
      }
    }
  }

  /**
   * Check if currently recording
   * @returns {Promise<boolean>}
   */
  async isRecording() {
    return this.recording;
  }

  /**
   * Get milliseconds elapsed since dashcam started recording
   * @returns {number|null} Milliseconds since start, or null if not recording
   */
  getElapsedTime() {
    if (!this.recording || !this.startTime) {
      return null;
    }
    return Date.now() - this.startTime;
  }
}

module.exports = Dashcam;
