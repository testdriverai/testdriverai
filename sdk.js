#!/usr/bin/env node

/**
 * TestDriver SDK
 * 
 * This SDK provides programmatic access to TestDriver's AI-powered testing capabilities.
 * 
 * @example
 * const TestDriver = require('testdriverai');
 * 
 * const client = new TestDriver(process.env.TD_API_KEY);
 * await client.connect();
 * 
 * await client.hoverText('Submit');
 * await client.click();
 */

const { createConfig } = require("./agent/lib/config.js");
const { createSession } = require("./agent/lib/session.js");
const { createSDK } = require("./agent/lib/sdk.js");
const { createSandbox } = require("./agent/lib/sandbox.js");
const { createSystem } = require("./agent/lib/system.js");
const { createCommands } = require("./agent/lib/commands.js");
const { createAnalytics } = require("./agent/lib/analytics.js");
const { createEmitter, events } = require("./agent/events.js");
const { createOutputs } = require("./agent/lib/outputs.js");
const { logger, createMarkdownLogger } = require("./interfaces/logger.js");

class TestDriverSDK {
  constructor(apiKey, options = {}) {
    // Create event emitter for internal communication
    this.emitter = createEmitter();
    
    // Set up logging if enabled
    this.loggingEnabled = options.logging !== false;
    
    // Initialize logger for markdown and regular logs
    if (this.loggingEnabled) {
      this._setupLogging();
    }
    
    // Set up environment with API key
    const environment = {
      TD_API_KEY: apiKey,
      TD_API_ROOT: options.apiRoot || "https://v6.testdriver.ai",
      TD_RESOLUTION: options.resolution || "1366x768",
      TD_ANALYTICS: options.analytics !== false,
      ...options.environment
    };

    // Create config instance
    this.config = createConfig(environment);

    // Create session instance
    this.session = createSession();

    // Create outputs instance
    this.outputs = createOutputs();

    // Create SDK API client
    this.apiClient = createSDK(this.emitter, this.config, this.session);

    // Create analytics instance
    this.analytics = createAnalytics(this.emitter, this.config, this.session);

    // Create sandbox instance
    this.sandbox = createSandbox(this.emitter, this.analytics);

    // Create system instance
    this.system = createSystem(this.emitter, this.sandbox, this.config);

    // Store options for later use
    this.options = options;
    
    // Track connection state
    this.connected = false;
    this.authenticated = false;

    // Instance reference
    this.instance = null;
  }

  /**
   * Authenticate with TestDriver API
   * @returns {Promise<string>} Authentication token
   */
  async auth() {
    if (this.authenticated) {
      return;
    }

    const token = await this.apiClient.auth();
    this.authenticated = true;
    return token;
  }

  /**
   * Connect to a sandbox environment
   * @param {Object} options - Connection options
   * @param {string} options.sandboxId - Existing sandbox ID to reconnect to
   * @param {boolean} options.newSandbox - Force creation of a new sandbox
   * @param {string} options.ip - Direct IP address to connect to
   * @param {string} options.sandboxAmi - AMI to use for the sandbox
   * @param {string} options.sandboxInstance - Instance type for the sandbox
   * @returns {Promise<Object>} Sandbox instance details
   */
  async connect(connectOptions = {}) {
    if (this.connected) {
      return this.instance;
    }

    // Authenticate first if not already authenticated
    if (!this.authenticated) {
      await this.auth();
    }

    // Connect to sandbox service
    await this.sandbox.boot(this.config.TD_API_ROOT);
    await this.sandbox.auth(this.config.TD_API_KEY);

    // Determine connection strategy
    if (connectOptions.ip) {
      // Direct connection to IP
      this.instance = await this.sandbox.send({
        type: "direct",
        resolution: this.config.TD_RESOLUTION,
        ci: this.config.CI,
        ip: connectOptions.ip,
      });
    } else if (connectOptions.sandboxId) {
      // Connect to existing sandbox
      this.instance = await this.sandbox.connect(connectOptions.sandboxId, true);
    } else if (connectOptions.newSandbox) {
      // Create new sandbox
      const sandboxConfig = {
        type: "create",
        resolution: this.config.TD_RESOLUTION,
        ci: this.config.CI,
      };

      if (connectOptions.sandboxAmi) {
        sandboxConfig.ami = connectOptions.sandboxAmi;
      }
      if (connectOptions.sandboxInstance) {
        sandboxConfig.instanceType = connectOptions.sandboxInstance;
      }

      const newSandbox = await this.sandbox.send(sandboxConfig);
      this.instance = await this.sandbox.connect(newSandbox.sandbox.instanceId, true);
    } else {
      // Default: create new sandbox
      const newSandbox = await this.sandbox.send({
        type: "create",
        resolution: this.config.TD_RESOLUTION,
        ci: this.config.CI,
      });
      this.instance = await this.sandbox.connect(newSandbox.sandbox.instanceId, true);
    }

    // Initialize commands after sandbox is connected
    const getCurrentFilePath = () => null; // SDK doesn't use file paths
    const commandsResult = createCommands(
      this.emitter,
      this.system,
      this.sandbox,
      this.config,
      this.session,
      getCurrentFilePath
    );
    this.commands = commandsResult.commands;

    // Start a new session
    const sessionRes = await this.apiClient.req("session/start", {
      systemInformationOsInfo: await this.system.getSystemInformationOsInfo(),
      mousePosition: await this.system.getMousePosition(),
      activeWindow: await this.system.activeWin(),
    });

    if (sessionRes?.data?.id) {
      this.session.set(sessionRes.data.id);
    }

    this.connected = true;
    this.analytics.track("sdk.connect", { sandboxId: this.instance?.instanceId });

    return this.instance;
  }

  /**
   * Disconnect from the sandbox
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.connected && this.instance) {
      // Could add cleanup logic here if needed
      this.analytics.track("sdk.disconnect");
      this.connected = false;
      this.instance = null;
    }
  }

  // ====================================
  // Command Methods
  // ====================================

  /**
   * Hover over text on screen
   * @param {string} text - Text to find and hover over
   * @param {string} description - Optional description
   * @param {string} action - Action to perform (default: 'click')
   * @param {string} method - Match method (default: 'turbo')
   * @param {number} timeout - Timeout in ms (default: 5000)
   */
  async hoverText(text, description = null, action = "click", method = "turbo", timeout = 5000) {
    this._ensureConnected();
    return await this.commands["hover-text"](text, description, action, method, timeout);
  }

  /**
   * Hover over an image on screen
   * @param {string} description - Description of the image to find
   * @param {string} action - Action to perform (default: 'click')
   */
  async hoverImage(description, action = "click") {
    this._ensureConnected();
    return await this.commands["hover-image"](description, action);
  }

  /**
   * Match and interact with an image template
   * @param {string} imagePath - Path to the image template
   * @param {string} action - Action to perform (default: 'click')
   * @param {boolean} invert - Invert the match (default: false)
   */
  async matchImage(imagePath, action = "click", invert = false) {
    this._ensureConnected();
    return await this.commands["match-image"](imagePath, action, invert);
  }

  /**
   * Type text
   * @param {string} text - Text to type
   * @param {number} delay - Delay between keystrokes in ms (default: 250)
   */
  async type(text, delay = 250) {
    this._ensureConnected();
    return await this.commands.type(text, delay);
  }

  /**
   * Press keyboard keys
   * @param {Array<string>} keys - Array of keys to press
   */
  async pressKeys(keys) {
    this._ensureConnected();
    return await this.commands["press-keys"](keys);
  }

  /**
   * Click at coordinates or last hover position
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {string} action - Type of click (default: 'click')
   */
  async click(x, y, action = "click") {
    this._ensureConnected();
    return await this.commands.click(x, y, action);
  }

  /**
   * Hover at coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  async hover(x, y) {
    this._ensureConnected();
    return await this.commands.hover(x, y);
  }

  /**
   * Scroll the page
   * @param {string} direction - Direction to scroll ('up' or 'down')
   * @param {number} amount - Amount to scroll in pixels (default: 300)
   * @param {string} method - Scroll method ('mouse' or 'keyboard')
   */
  async scroll(direction = "down", amount = 300, method = "mouse") {
    this._ensureConnected();
    return await this.commands.scroll(direction, amount, method);
  }

  /**
   * Wait for specified time
   * @param {number} timeout - Time to wait in ms (default: 3000)
   */
  async wait(timeout = 3000) {
    this._ensureConnected();
    return await this.commands.wait(timeout);
  }

  /**
   * Wait for text to appear on screen
   * @param {string} text - Text to wait for
   * @param {number} timeout - Timeout in ms (default: 5000)
   * @param {string} method - Match method (default: 'turbo')
   * @param {boolean} invert - Invert the match (default: false)
   */
  async waitForText(text, timeout = 5000, method = "turbo", invert = false) {
    this._ensureConnected();
    return await this.commands["wait-for-text"](text, timeout, method, invert);
  }

  /**
   * Wait for image to appear on screen
   * @param {string} description - Description of the image
   * @param {number} timeout - Timeout in ms (default: 10000)
   * @param {boolean} invert - Invert the match (default: false)
   */
  async waitForImage(description, timeout = 10000, invert = false) {
    this._ensureConnected();
    return await this.commands["wait-for-image"](description, timeout, invert);
  }

  /**
   * Scroll until text is found
   * @param {string} text - Text to find
   * @param {string} direction - Scroll direction (default: 'down')
   * @param {number} maxDistance - Max pixels to scroll (default: 10000)
   * @param {string} textMatchMethod - Match method (default: 'turbo')
   * @param {string} method - Scroll method (default: 'keyboard')
   * @param {boolean} invert - Invert the match (default: false)
   */
  async scrollUntilText(text, direction = "down", maxDistance = 10000, textMatchMethod = "turbo", method = "keyboard", invert = false) {
    this._ensureConnected();
    return await this.commands["scroll-until-text"](text, direction, maxDistance, textMatchMethod, method, invert);
  }

  /**
   * Scroll until image is found
   * @param {string} description - Description of the image (or use path parameter)
   * @param {string} direction - Scroll direction (default: 'down')
   * @param {number} maxDistance - Max pixels to scroll (default: 10000)
   * @param {string} method - Scroll method (default: 'keyboard')
   * @param {string} path - Path to image template
   * @param {boolean} invert - Invert the match (default: false)
   */
  async scrollUntilImage(description, direction = "down", maxDistance = 10000, method = "keyboard", path = null, invert = false) {
    this._ensureConnected();
    return await this.commands["scroll-until-image"](description, direction, maxDistance, method, path, invert);
  }

  /**
   * Focus an application by name
   * @param {string} name - Application name
   */
  async focusApplication(name) {
    this._ensureConnected();
    return await this.commands["focus-application"](name);
  }

  /**
   * Remember information from the screen
   * @param {string} description - What to remember
   */
  async remember(description) {
    this._ensureConnected();
    return await this.commands.remember(description);
  }

  /**
   * Assert a condition
   * @param {string} assertion - Assertion to check
   * @param {boolean} async - Run asynchronously (default: false)
   * @param {boolean} invert - Invert the assertion (default: false)
   */
  async assert(assertion, async = false, invert = false) {
    this._ensureConnected();
    return await this.commands.assert(assertion, async, invert);
  }

  /**
   * Execute code
   * @param {string} language - Language ('js' or 'pwsh')
   * @param {string} code - Code to execute
   * @param {number} timeout - Timeout in ms
   * @param {boolean} silent - Suppress output (default: false)
   */
  async exec(language, code, timeout, silent = false) {
    this._ensureConnected();
    return await this.commands.exec(language, code, timeout, silent);
  }

  // ====================================
  // Helper Methods
  // ====================================

  /**
   * Ensure the SDK is connected before running commands
   * @private
   */
  _ensureConnected() {
    if (!this.connected) {
      throw new Error("SDK is not connected. Call connect() first.");
    }
  }

  /**
   * Get the current sandbox instance details
   * @returns {Object|null} Sandbox instance
   */
  getInstance() {
    return this.instance;
  }

  /**
   * Get the session ID
   * @returns {string|null} Session ID
   */
  getSessionId() {
    return this.session.get();
  }

  /**
   * Enable or disable logging output
   * @param {boolean} enabled - Whether to enable logging
   */
  setLogging(enabled) {
    this.loggingEnabled = enabled;
    if (enabled && !this._loggingSetup) {
      this._setupLogging();
    }
  }

  /**
   * Get the event emitter for custom event handling
   * @returns {EventEmitter2} Event emitter
   */
  getEmitter() {
    return this.emitter;
  }

  /**
   * Set up logging for the SDK
   * @private
   */
  _setupLogging() {
    if (this._loggingSetup) return;
    this._loggingSetup = true;

    // Set up markdown logger
    createMarkdownLogger(this.emitter);

    // Set up basic event logging
    this.emitter.on("log:*", (message) => {
      const event = this.emitter.event;
      if (event === events.log.debug) return;
      if (this.loggingEnabled && message) {
        console.log(message);
      }
    });

    this.emitter.on("error:*", (data) => {
      if (this.loggingEnabled) {
        const event = this.emitter.event;
        console.error(event, ":", data);
      }
    });

    this.emitter.on("status", (message) => {
      if (this.loggingEnabled) {
        console.log(`- ${message}`);
      }
    });
  }
}

module.exports = TestDriverSDK;
