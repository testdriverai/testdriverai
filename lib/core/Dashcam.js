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

const { logger } = require("../../interfaces/logger");

class Dashcam {
  /**
   * Create a Dashcam instance
   * @param {Object} client - TestDriver client instance
   * @param {Object} options - Configuration options
   * @param {string} [options.apiKey] - Dashcam API key
   * @param {boolean} [options.autoStart=false] - Auto-start recording
   * @param {Array} [options.logs=[]] - Log configurations to add
   * @param {string} [options.title] - Recording title (defaults to generated title)
   */
  constructor(client, options = {}) {
    if (!client) {
      throw new Error("Dashcam requires a TestDriver client instance");
    }

    this.client = client;
    // Use provided apiKey, or client's apiKey, or fallback to a default
    this.apiKey =
      options.apiKey ||
      client.apiKey ||
      client.config?.TD_API_KEY ||
      "4e93d8bf-3886-4d26-a144-116c4063522d";
    this.autoStart = options.autoStart ?? false;
    this.logs = options.logs || [];
    this.recording = false;
    this._authenticated = false;
    this.startTime = null; // Track when dashcam recording started
    this.title = options.title || this._generateDefaultTitle();
  }

  /**
   * Generate a default title for the recording
   * Uses test context if available, otherwise falls back to timestamp
   * @private
   */
  _generateDefaultTitle() {
    // Check for Vitest context
    if (this.client.__vitestContext) {
      const task = this.client.__vitestContext;
      const testName = task.name || "Test";
      const fileName = task.file?.name || task.file?.filepath;
      if (fileName) {
        const baseName = fileName
          .split("/")
          .pop()
          .replace(/\.(test|spec)\.(js|mjs|ts|tsx)$/, "");
        return `${baseName} - ${testName}`;
      }
      return testName;
    }

    // Fallback to timestamp
    const now = new Date();
    return `Recording ${now.toISOString().replace(/T/, " ").replace(/\..+/, "")}`;
  }

  /**
   * Get shell type based on client OS
   * @private
   */
  _getShell() {
    return this.client.os === "windows" ? "pwsh" : "sh";
  }

  /**
   * Get TD_API_ROOT from client config
   * @private
   */
  _getApiRoot() {
    return (
      this.client.config?.TD_API_ROOT || "https://testdriver-api.onrender.com"
    );
  }

  /**
   * Get console URL based on API root
   * Maps API endpoints to their corresponding web console URLs
   * @param {string} apiRoot - The API root URL
   * @returns {string} The corresponding console URL
   */
  static getConsoleUrl(apiRoot = "https://testdriver-api.onrender.com") {
    // Map API roots to console URLs
    const apiToConsoleMap = {
      "https://testdriver-api.onrender.com": "https://console.testdriver.ai",
      "https://v6.testdriver.ai": "https://console.testdriver.ai",
      "https://replayable-dev-ian-mac-m1-16.ngrok.io": "http://localhost:3001",
    };

    return apiToConsoleMap[apiRoot] || "https://console.testdriver.ai";
  }

  /**
   * Get dashcam executable path
   * @private
   */
  async _getDashcamPath() {
    const shell = this._getShell();
    const npmPrefix = await this.client.exec(
      shell,
      "npm prefix -g",
      40000,
      process.env.DEBUG == "true" ? false : true,
    );

    if (this.client.os === "windows") {
      return "C:\\Program Files\\nodejs\\dashcam.cmd";
    }
    return npmPrefix.trim() + "/bin/dashcam";
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

    if (this.client.os === "windows") {
      const dashcamPath = await this._getDashcamPath();
      this._log("debug", "Dashcam executable path:", dashcamPath);

      // Authenticate with TD_API_ROOT
      const authOutput = await this.client.exec(
        shell,
        `$env:TD_API_ROOT="${apiRoot}"; & "${dashcamPath}" auth ${key}`,
        120000,
        process.env.DEBUG == "true" ? false : true,
      );
      this._log("debug", "Auth output:", authOutput);
    } else {
      // Linux/Mac authentication with TD_API_ROOT
      const authOutput = await this.client.exec(
        shell,
        `TD_API_ROOT="${apiRoot}" dashcam auth ${key}`,
        120000,
        process.env.DEBUG == "true" ? false : true,
      );
      this._log("debug", "Auth output:", authOutput);
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

    if (this.client.os === "windows") {
      // Create log file if it doesn't exist
      const createFileOutput = await this.client.exec(
        shell,
        `New-Item -ItemType File -Path "${path}" -Force`,
        10000,
        process.env.DEBUG == "true" ? false : true,
      );
      this._log("debug", "Create log file output:", createFileOutput);

      const dashcamPath = await this._getDashcamPath();
      const addLogOutput = await this.client.exec(
        shell,
        `$env:TD_API_ROOT="${apiRoot}"; & "${dashcamPath}" logs --add --type=file --file="${path}" --name="${name}"`,
        120000,
        process.env.DEBUG == "true" ? false : true,
      );
      this._log("debug", "Add log tracking output:", addLogOutput);
    } else {
      // Create log file
      await this.client.exec(
        shell,
        `touch ${path}`,
        10000,
        process.env.DEBUG == "true" ? false : true,
      );

      // Add log tracking with TD_API_ROOT
      const addLogOutput = await this.client.exec(
        shell,
        `TD_API_ROOT="${apiRoot}" dashcam logs --add --type=file --file="${path}" --name="${name}"`,
        10000,
        process.env.DEBUG == "true" ? false : true,
      );
      this._log("debug", "Add log tracking output:", addLogOutput);
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

    if (this.client.os === "windows") {
      const addLogOutput = await this.client.exec(
        shell,
        `$env:TD_API_ROOT="${apiRoot}"; & "${dashcamPath}" logs --add --type=application --application="${application}" --name="${name}"`,
        120000,
        process.env.DEBUG == "true" ? false : true,
      );
      this._log("debug", "Add application log tracking output:", addLogOutput);
    } else {
      const addLogOutput = await this.client.exec(
        shell,
        `TD_API_ROOT="${apiRoot}" dashcam logs --add --type=application --application="${application}" --name="${name}"`,
        10000,
        process.env.DEBUG == "true" ? false : true,
      );
      this._log("debug", "Add application log tracking output:", addLogOutput);
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

    if (this.client.os === "windows") {
      const addLogOutput = await this.client.exec(
        shell,
        `$env:TD_API_ROOT="${apiRoot}"; & "${dashcamPath}" logs --add --type=web --pattern="${pattern}" --name="${name}"`,
        120000,
        process.env.DEBUG == "true" ? false : true,
      );
      this._log("debug", "Add web log tracking output:", addLogOutput);
    } else {
      const addLogOutput = await this.client.exec(
        shell,
        `TD_API_ROOT="${apiRoot}" dashcam logs --add --type=web --pattern="${pattern}" --name="${name}"`,
        10000,
        process.env.DEBUG == "true" ? false : true,
      );
      this._log("debug", "Add web log tracking output:", addLogOutput);
    }
  }

  /**
   * Start dashcam recording
   * @returns {Promise<void>}
   */
  async start() {
    if (this.recording) {
      this._log("warn", "Dashcam already recording");
      return;
    }

    // Auto-authenticate if not already done
    if (!this._authenticated) {
      await this.auth();
    }

    const shell = this._getShell();
    const apiRoot = this._getApiRoot();

    if (this.client.os === "windows") {
      const dashcamPath = await this._getDashcamPath();

      // Start dashcam record and redirect output with TD_API_ROOT
      const outputFile =
        "C:\\Users\\testdriver\\.dashcam-cli\\dashcam-start.log";
      //  const titleArg = this.title ? ` --title=\`"${this.title.replace(/"/g, '`"')}\`"` : '';
      let titleArg = "";
      const startScript = `
        try {
          $env:TD_API_ROOT="${apiRoot}"
          $process = Start-Process "cmd.exe" -ArgumentList "/c", "\`"${dashcamPath}\`" record${titleArg}"
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

      // add  2>&1" -PassThru

      // Capture startTime right before issuing the dashcam command to sync with actual recording start
      this.startTime = Date.now();
      const startOutput = await this.client.exec(
        shell,
        startScript,
        10000,
        process.env.DEBUG == "true" ? false : true,
      );
      this._log("debug", "Start-Process output:", startOutput);

      // Wait and check output
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const dashcamOutput = await this.client.exec(
        shell,
        `Get-Content "${outputFile}" -ErrorAction SilentlyContinue`,
        10000,
        process.env.DEBUG == "true" ? false : true,
      );
      this._log("debug", "Dashcam record output:", dashcamOutput);

      // Give process time to initialize
      await new Promise((resolve) => setTimeout(resolve, 5000));

      this._log("debug", "Dashcam recording started");
    } else {
      // Linux/Mac with TD_API_ROOT
      this._log("debug", "Starting dashcam recording on Linux/Mac...");
      const titleArg = this.title
        ? ` --title="${this.title.replace(/"/g, '"')}"`
        : "";
      // Capture startTime right before issuing the dashcam command to sync with actual recording start
      this.startTime = Date.now();
      await this.client.exec(
        shell,
        `TD_API_ROOT="${apiRoot}" dashcam record${titleArg} >/dev/null 2>&1 &`,
        10000,
        process.env.DEBUG == "true" ? false : true,
      );
      this._log("debug", "Dashcam recording started");
    }

    this.recording = true;
  }

  /**
   * Set the recording title
   * This can be called before start() to customize the title
   * @param {string} title - Custom recording title
   */
  setTitle(title) {
    this.title = title;
    this._log("debug", `Set dashcam recording title: ${title}`);
  }

  /**
   * Stop dashcam recording and retrieve replay URL
   * @returns {Promise<string|null>} Replay URL if available
   */
  async stop() {
    if (!this.recording) {
      // Internal log only - don't spam user console
      this._log("warn", "Dashcam not recording");
      return null;
    }

    this._log("debug", "Stopping dashcam and retrieving URL...");
    const shell = this._getShell();
    const apiRoot = this._getApiRoot();
    let output;

    if (this.client.os === "windows") {
      this._log("debug", "Stopping dashcam process on Windows...");

      const dashcamPath = await this._getDashcamPath();

      // Stop and get output with TD_API_ROOT
      output = await this.client.exec(
        shell,
        `$env:TD_API_ROOT="${apiRoot}"; & "${dashcamPath}" stop`,
        300000,
        process.env.DEBUG == "true" ? false : true,
      );
      this._log("debug", "Dashcam stop command output:", output);
    } else {
      // Linux/Mac with TD_API_ROOT
      const dashcamPath = await this._getDashcamPath();
      output = await this.client.exec(
        shell,
        `TD_API_ROOT="${apiRoot}" "${dashcamPath}" stop`,
        300000,
        process.env.DEBUG == "true" ? false : true,
      );
      this._log("debug", "Dashcam command output:", output);
    }

    this.recording = false;

    // Extract URL from output
    if (output) {
      // Look for replay URL with optional query parameters (most specific)
      // Matches: http://localhost:3001/replay/abc123?share=xyz or https://app.dashcam.io/replay/abc123
      const replayUrlMatch = output.match(
        /https?:\/\/[^\s"',}]+\/replay\/[^\s"',}]+/,
      );
      if (replayUrlMatch) {
        let url = replayUrlMatch[0];
        // Remove trailing punctuation but keep query params
        url = url.replace(/[.,;:!\)\]]+$/, "").trim();
        return url;
      }

      // Fallback: any dashcam.io or testdriver.ai URL
      const dashcamUrlMatch = output.match(
        /https?:\/\/(?:app\.)?(?:dashcam\.io|testdriver\.ai)[^\s"',}]+/,
      );
      if (dashcamUrlMatch) {
        let url = dashcamUrlMatch[0];
        url = url.replace(/[.,;:!\?\)\]]+$/, "").trim();
        return url;
      }

      this._log("warn", "No replay URL found in dashcam output");
    } else {
      this._log("warn", "Dashcam command returned no output");
    }

    return null;
  }

  /**
   * Internal logging - uses TestDriver logger
   * @private
   */
  _log(level, ...args) {
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
      )
      .join(" ");

    const logMessage = `[DASHCAM] ${message}`;

    // Use the TestDriver logger based on level
    switch (level) {
      case "error":
        logger.error(logMessage);
        break;
      case "warn":
        logger.warn(logMessage);
        break;
      case "debug":
        logger.debug(logMessage);
        break;
      case "info":
      default:
        logger.info(logMessage);
        break;
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
