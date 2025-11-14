#!/usr/bin/env node

/**
 * Element class representing a located or to-be-located element
 */
class Element {
  constructor(description, sdk, system, commands) {
    this.description = description;
    this.sdk = sdk;
    this.system = system;
    this.commands = commands;
    this.coordinates = null;
    /* The above code is a JavaScript comment block that sets the `_found` property of an object to
    `false`. The code snippet does not contain any executable code, it is just a comment. */
    this._found = false;
    this._response = null;
  }

  /**
   * Check if element was found
   * @returns {boolean} True if element coordinates were located
   */
  found() {
    return this._found;
  }

  /**
   * Find the element on screen
   * @param {string} [newDescription] - Optional new description to search for
   * @returns {Promise<Element>} This element instance
   */
  async find(newDescription) {
    const description = newDescription || this.description;
    if (newDescription) {
      this.description = newDescription;
    }

    try {
      const response = await this.sdk.req(
        "locate",
        {
          element: description,
          image: await this.system.captureScreenBase64(),
        }
      );

      if (response && response.coordinates) {
        this._response = response;
        this.coordinates = response.coordinates;
        this._found = true;
      } else {
        this._response = null;
        this._found = false;
      }
    } catch {
      this._response = null;
      this._found = false;
    }

    return this;
  }

  /**
   * Click on the element
   * @param {ClickAction} [action='click'] - Type of click action
   * @returns {Promise<void>}
   */
  async click(action = 'click') {
    if (!this._found || !this.coordinates) {
      throw new Error(`Element "${this.description}" not found. Call find() first.`);
    }

    if (action === 'hover') {
      await this.commands.hover(this.coordinates.x, this.coordinates.y);
    } else {
      await this.commands.click(this.coordinates.x, this.coordinates.y, action);
    }
  }

  /**
   * Hover over the element
   * @returns {Promise<void>}
   */
  async hover() {
    if (!this._found || !this.coordinates) {
      throw new Error(`Element "${this.description}" not found. Call find() first.`);
    }

    await this.commands.hover(this.coordinates.x, this.coordinates.y);
  }

  /**
   * Double-click on the element
   * @returns {Promise<void>}
   */
  async doubleClick() {
    return this.click('double-click');
  }

  /**
   * Right-click on the element
   * @returns {Promise<void>}
   */
  async rightClick() {
    return this.click('right-click');
  }

  /**
   * Press mouse button down on this element
   * @returns {Promise<void>}
   */
  async mouseDown() {
    return this.click('mouseDown');
  }

  /**
   * Release mouse button on this element
   * @returns {Promise<void>}
   */
  async mouseUp() {
    return this.click('mouseUp');
  }

  /**
   * Get the coordinates of the element
   * @returns {{x: number, y: number, centerX: number, centerY: number}|null}
   */
  getCoordinates() {
    return this.coordinates;
  }

  /**
   * Get the x coordinate (top-left)
   * @returns {number|null}
   */
  get x() {
    return this.coordinates?.x ?? null;
  }

  /**
   * Get the y coordinate (top-left)
   * @returns {number|null}
   */
  get y() {
    return this.coordinates?.y ?? null;
  }

  /**
   * Get the center x coordinate
   * @returns {number|null}
   */
  get centerX() {
    return this.coordinates?.centerX ?? null;
  }

  /**
   * Get the center y coordinate
   * @returns {number|null}
   */
  get centerY() {
    return this.coordinates?.centerY ?? null;
  }

  /**
   * Get the full API response data
   * @returns {Object|null}
   */
  getResponse() {
    return this._response;
  }

  /**
   * Get element screenshot if available
   * @returns {string|null} Base64 encoded screenshot
   */
  get screenshot() {
    return this._response?.screenshot ?? null;
  }

  /**
   * Get element confidence score if available
   * @returns {number|null}
   */
  get confidence() {
    return this._response?.confidence ?? null;
  }

  /**
   * Get element width if available
   * @returns {number|null}
   */
  get width() {
    return this._response?.width ?? null;
  }

  /**
   * Get element height if available
   * @returns {number|null}
   */
  get height() {
    return this._response?.height ?? null;
  }

  /**
   * Get element bounding box if available
   * @returns {Object|null}
   */
  get boundingBox() {
    return this._response?.boundingBox ?? null;
  }

  /**
   * Get element text content if available
   * @returns {string|null}
   */
  get text() {
    return this._response?.text ?? null;
  }

  /**
   * Get element label if available
   * @returns {string|null}
   */
  get label() {
    return this._response?.label ?? null;
  }
}

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
 * // New API
 * const element = await client.find('Submit button');
 * await element.click();
 * 
 * // Legacy API (deprecated)
 * await client.hoverText('Submit');
 * await client.click();
 */

/**
 * @typedef {'click' | 'right-click' | 'double-click' | 'hover' | 'mouseDown' | 'mouseUp'} ClickAction
 * @typedef {'up' | 'down' | 'left' | 'right'} ScrollDirection
 * @typedef {'keyboard' | 'mouse'} ScrollMethod
 * @typedef {'ai' | 'turbo'} TextMatchMethod
 * @typedef {'js' | 'pwsh'} ExecLanguage
 * @typedef {'\\t' | '\n' | '\r' | ' ' | '!' | '"' | '#' | '$' | '%' | '&' | "'" | '(' | ')' | '*' | '+' | ',' | '-' | '.' | '/' | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ':' | ';' | '<' | '=' | '>' | '?' | '@' | '[' | '\\' | ']' | '^' | '_' | '`' | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm' | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z' | '{' | '|' | '}' | '~' | 'accept' | 'add' | 'alt' | 'altleft' | 'altright' | 'apps' | 'backspace' | 'browserback' | 'browserfavorites' | 'browserforward' | 'browserhome' | 'browserrefresh' | 'browsersearch' | 'browserstop' | 'capslock' | 'clear' | 'convert' | 'ctrl' | 'ctrlleft' | 'ctrlright' | 'decimal' | 'del' | 'delete' | 'divide' | 'down' | 'end' | 'enter' | 'esc' | 'escape' | 'execute' | 'f1' | 'f10' | 'f11' | 'f12' | 'f13' | 'f14' | 'f15' | 'f16' | 'f17' | 'f18' | 'f19' | 'f2' | 'f20' | 'f21' | 'f22' | 'f23' | 'f24' | 'f3' | 'f4' | 'f5' | 'f6' | 'f7' | 'f8' | 'f9' | 'final' | 'fn' | 'hanguel' | 'hangul' | 'hanja' | 'help' | 'home' | 'insert' | 'junja' | 'kana' | 'kanji' | 'launchapp1' | 'launchapp2' | 'launchmail' | 'launchmediaselect' | 'left' | 'modechange' | 'multiply' | 'nexttrack' | 'nonconvert' | 'num0' | 'num1' | 'num2' | 'num3' | 'num4' | 'num5' | 'num6' | 'num7' | 'num8' | 'num9' | 'numlock' | 'pagedown' | 'pageup' | 'pause' | 'pgdn' | 'pgup' | 'playpause' | 'prevtrack' | 'print' | 'printscreen' | 'prntscrn' | 'prtsc' | 'prtscr' | 'return' | 'right' | 'scrolllock' | 'select' | 'separator' | 'shift' | 'shiftleft' | 'shiftright' | 'sleep' | 'space' | 'stop' | 'subtract' | 'tab' | 'up' | 'volumedown' | 'volumemute' | 'volumeup' | 'win' | 'winleft' | 'winright' | 'yen' | 'command' | 'option' | 'optionleft' | 'optionright'} KeyboardKey
 */

const TestDriverAgent = require("./agent/index.js");
const { events } = require("./agent/events.js");
const { createMarkdownLogger } = require("./interfaces/logger.js");

class TestDriverSDK {
  constructor(apiKey, options = {}) {
    // Set up environment with API key
    const environment = {
      TD_API_KEY: apiKey,
      TD_API_ROOT: options.apiRoot || "https://testdriver-api.onrender.com",
      TD_RESOLUTION: options.resolution || "1366x768",
      TD_ANALYTICS: options.analytics !== false,
      ...options.environment
    };

    // Create the underlying agent with minimal CLI args
    this.agent = new TestDriverAgent(environment, {
      command: 'sdk',
      args: [],
      options: {
        os: options.os || 'windows'
      }
    });

    // Store options for later use
    this.options = options;
    
    // Track connection state
    this.connected = false;
    this.authenticated = false;

    // Expose commonly used agent properties
    this.emitter = this.agent.emitter;
    this.config = this.agent.config;
    this.session = this.agent.session;
    this.apiClient = this.agent.sdk;
    this.analytics = this.agent.analytics;
    this.sandbox = this.agent.sandbox;
    this.system = this.agent.system;
    this.instance = null;

    // Commands will be set up dynamically after connection
    this.commands = null;

    // Set up logging if enabled (after emitter is exposed)
    this.loggingEnabled = options.logging !== false;
    
    // Initialize logger for markdown and regular logs
    if (this.loggingEnabled) {
      this._setupLogging();
    }
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
   * @param {string} options.os - Operating system for the sandbox (windows or linux)
   * @param {boolean} options.reuseConnection - Reuse recent connection if available (default: true)
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

    // Initialize debugger server before connecting to sandbox
    // This ensures the debuggerUrl is available for renderSandbox
    await this._initializeDebugger();

    // Map SDK connect options to agent buildEnv options
    const buildEnvOptions = {
      headless: connectOptions.headless || false,
      new: connectOptions.newSandbox || false,
    };

    // Set agent properties for buildEnv to use
    if (connectOptions.sandboxId) {
      this.agent.sandboxId = connectOptions.sandboxId;
    }
    if (connectOptions.ip) {
      this.agent.ip = connectOptions.ip;
    }
    if (connectOptions.sandboxAmi) {
      this.agent.sandboxAmi = connectOptions.sandboxAmi;
    }
    if (connectOptions.sandboxInstance) {
      this.agent.sandboxInstance = connectOptions.sandboxInstance;
    }
    if (connectOptions.os) {
      this.agent.sandboxOs = connectOptions.os;
    }

    // Use the agent's buildEnv method which handles all the connection logic
    await this.agent.buildEnv(buildEnvOptions);

    // Get the instance from the agent
    this.instance = this.agent.instance;

    // Expose the agent's commands, parser, and commander
    this.commands = this.agent.commands;

    // Dynamically create command methods based on available commands
    this._setupCommandMethods();

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
  // Element Finding API
  // ====================================

  /**
   * Find an element by description
   * Automatically locates the element and returns it
   * 
   * @param {string} description - Description of the element to find
   * @returns {Promise<Element>} Element instance that has been located
   * 
   * @example
   * // Find and click immediately
   * const element = await client.find('the sign in button');
   * await element.click();
   * 
   * @example
   * // Poll until element is found
   * let element;
   * while (!element?.found()) {
   *   element = await client.find('login button');
   *   if (!element.found()) {
   *     await new Promise(resolve => setTimeout(resolve, 1000));
   *   }
   * }
   * await element.click();
   */
  async find(description) {
    this._ensureConnected();
    const element = new Element(
      description,
      this.apiClient,
      this.system,
      this.commands
    );
    return await element.find();
  }

  // ====================================
  // Command Methods Setup
  // ====================================

  /**
   * Dynamically set up command methods based on available commands
   * This creates camelCase methods that wrap the underlying command functions
   * @private
   */
  _setupCommandMethods() {
    // Mapping from command names to SDK method names with type definitions
    const commandMapping = {
      'hover-text': { 
        name: 'hoverText',
        /**
         * Hover over text on screen
         * @deprecated Use find() and element.click() instead
         * @param {string} text - Text to find and hover over
         * @param {string | null} [description] - Optional description of the element
         * @param {ClickAction} [action='click'] - Action to perform
         * @param {TextMatchMethod} [method='turbo'] - Text matching method
         * @param {number} [timeout=5000] - Timeout in milliseconds
         * @returns {Promise<{x: number, y: number, centerX: number, centerY: number}>}
         */
        doc: 'Hover over text on screen (deprecated - use find() instead)'
      },
      'hover-image': { 
        name: 'hoverImage',
        /**
         * Hover over an image on screen
         * @deprecated Use find() and element.click() instead
         * @param {string} description - Description of the image to find
         * @param {ClickAction} [action='click'] - Action to perform
         * @returns {Promise<{x: number, y: number, centerX: number, centerY: number}>}
         */
        doc: 'Hover over an image on screen (deprecated - use find() instead)'
      },
      'match-image': { 
        name: 'matchImage',
        /**
         * Match and interact with an image template
         * @param {string} imagePath - Path to the image template
         * @param {ClickAction} [action='click'] - Action to perform
         * @param {boolean} [invert=false] - Invert the match
         * @returns {Promise<boolean>}
         */
        doc: 'Match and interact with an image template'
      },
      'type': { 
        name: 'type',
        /**
         * Type text
         * @param {string | number} text - Text to type
         * @param {number} [delay=250] - Delay between keystrokes in milliseconds
         * @returns {Promise<void>}
         */
        doc: 'Type text'
      },
      'press-keys': { 
        name: 'pressKeys',
        /**
         * Press keyboard keys
         * @param {KeyboardKey[]} keys - Array of keys to press
         * @returns {Promise<void>}
         */
        doc: 'Press keyboard keys'
      },
      'click': { 
        name: 'click',
        /**
         * Click at coordinates
         * @param {number} x - X coordinate
         * @param {number} y - Y coordinate
         * @param {ClickAction} [action='click'] - Type of click action
         * @returns {Promise<void>}
         */
        doc: 'Click at coordinates'
      },
      'hover': { 
        name: 'hover',
        /**
         * Hover at coordinates
         * @param {number} x - X coordinate
         * @param {number} y - Y coordinate
         * @returns {Promise<void>}
         */
        doc: 'Hover at coordinates'
      },
      'scroll': { 
        name: 'scroll',
        /**
         * Scroll the page
         * @param {ScrollDirection} [direction='down'] - Direction to scroll
         * @param {number} [amount=300] - Amount to scroll in pixels
         * @param {ScrollMethod} [method='mouse'] - Scroll method
         * @returns {Promise<void>}
         */
        doc: 'Scroll the page'
      },
      'wait': { 
        name: 'wait',
        /**
         * Wait for specified time
         * @deprecated Consider using element polling with find() instead of arbitrary waits
         * @param {number} [timeout=3000] - Time to wait in milliseconds
         * @returns {Promise<void>}
         */
        doc: 'Wait for specified time (deprecated - consider element polling instead)'
      },
      'wait-for-text': { 
        name: 'waitForText',
        /**
         * Wait for text to appear on screen
         * @deprecated Use find() in a polling loop instead
         * @param {string} text - Text to wait for
         * @param {number} [timeout=5000] - Timeout in milliseconds
         * @param {TextMatchMethod} [method='turbo'] - Text matching method
         * @param {boolean} [invert=false] - Invert the match (wait for text to disappear)
         * @returns {Promise<void>}
         */
        doc: 'Wait for text to appear on screen (deprecated - use find() in a loop instead)'
      },
      'wait-for-image': { 
        name: 'waitForImage',
        /**
         * Wait for image to appear on screen
         * @deprecated Use find() in a polling loop instead
         * @param {string} description - Description of the image
         * @param {number} [timeout=10000] - Timeout in milliseconds
         * @param {boolean} [invert=false] - Invert the match (wait for image to disappear)
         * @returns {Promise<void>}
         */
        doc: 'Wait for image to appear on screen (deprecated - use find() in a loop instead)'
      },
      'scroll-until-text': { 
        name: 'scrollUntilText',
        /**
         * Scroll until text is found
         * @param {string} text - Text to find
         * @param {ScrollDirection} [direction='down'] - Scroll direction
         * @param {number} [maxDistance=10000] - Maximum distance to scroll in pixels
         * @param {TextMatchMethod} [textMatchMethod='turbo'] - Text matching method
         * @param {ScrollMethod} [method='keyboard'] - Scroll method
         * @param {boolean} [invert=false] - Invert the match
         * @returns {Promise<void>}
         */
        doc: 'Scroll until text is found'
      },
      'scroll-until-image': { 
        name: 'scrollUntilImage',
        /**
         * Scroll until image is found
         * @param {string} description - Description of the image (or use path parameter)
         * @param {ScrollDirection} [direction='down'] - Scroll direction
         * @param {number} [maxDistance=10000] - Maximum distance to scroll in pixels
         * @param {ScrollMethod} [method='keyboard'] - Scroll method
         * @param {string | null} [path=null] - Path to image template
         * @param {boolean} [invert=false] - Invert the match
         * @returns {Promise<void>}
         */
        doc: 'Scroll until image is found'
      },
      'focus-application': { 
        name: 'focusApplication',
        /**
         * Focus an application by name
         * @param {string} name - Application name
         * @returns {Promise<string>}
         */
        doc: 'Focus an application by name'
      },
      'remember': { 
        name: 'remember',
        /**
         * Extract and remember information from the screen using AI
         * @param {string} description - What to remember
         * @returns {Promise<string>}
         */
        doc: 'Extract and remember information from the screen'
      },
      'assert': { 
        name: 'assert',
        /**
         * Make an AI-powered assertion
         * @param {string} assertion - Assertion to check
         * @returns {Promise<boolean>}
         */
        doc: 'Make an AI-powered assertion'
      },
      'exec': { 
        name: 'exec',
        /**
         * Execute code in the sandbox
         * @param {ExecLanguage} language - Language ('js' or 'pwsh')
         * @param {string} code - Code to execute
         * @param {number} timeout - Timeout in milliseconds
         * @param {boolean} [silent=false] - Suppress output
         * @returns {Promise<string>}
         */
        doc: 'Execute code in the sandbox'
      },
    };

    // Create SDK methods dynamically from commands
    Object.keys(this.commands).forEach(commandName => {
      const command = this.commands[commandName];
      const methodInfo = commandMapping[commandName];
      
      if (!methodInfo) {
        // Skip commands not in mapping
        return;
      }

      const methodName = methodInfo.name;

      // Create the wrapper method with proper stack trace handling
      this[methodName] = async function(...args) {
        this._ensureConnected();
        
        // Capture the call site for better error reporting
        const callSite = {};
        Error.captureStackTrace(callSite, this[methodName]);
        
        try {
          return await command(...args);
        } catch (error) {
          // Replace the stack trace to point to the actual caller instead of SDK internals
          if (Error.captureStackTrace && callSite.stack) {
            // Preserve the error message but use the captured call site stack
            const errorMessage = error.stack.split('\n')[0];
            const callerStack = callSite.stack.split('\n').slice(1); // Skip "Error" line
            error.stack = errorMessage + '\n' + callerStack.join('\n');
          }
          throw error;
        }
      }.bind(this);

      // Preserve the original function's name for better debugging
      Object.defineProperty(this[methodName], 'name', {
        value: methodName,
        writable: false
      });
    });
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
        // Forward logs to sandbox for debugger display
        this._forwardLogToSandbox(message);
      }
    });

    this.emitter.on("error:*", (data) => {
      if (this.loggingEnabled) {
        const event = this.emitter.event;
        console.error(event, ":", data);
        // Forward errors to sandbox
        const errorMessage = typeof data === 'object' ? JSON.stringify(data) : String(data);
        this._forwardLogToSandbox(`ERROR: ${errorMessage}`);
      }
    });

    this.emitter.on("status", (message) => {
      if (this.loggingEnabled) {
        console.log(`- ${message}`);
        // Forward status to sandbox
        this._forwardLogToSandbox(`- ${message}`);
      }
    });

    // Handle show window events for sandbox visualization
    this.emitter.on("show-window", async (url) => {
      if (this.loggingEnabled) {
        console.log("");
        console.log("Live test execution:");
        if (this.config.CI) {
          // In CI mode, just print the view-only URL
          const u = new URL(url);
          const data = JSON.parse(u.searchParams.get("data"));
          console.log(`${data.url}&view_only=true`);
        } else {
          // In local mode, print the URL and open it in the browser
          console.log(url);
          await this._openBrowser(url);
        }
      }
    });
  }

  /**
   * Forward log message to sandbox for debugger display
   * @private
   * @param {string} message - Log message to forward
   */
  _forwardLogToSandbox(message) {
    try {
      // Only forward if sandbox is connected
      if (this.sandbox && this.sandbox.instanceSocketConnected) {
        // Don't send objects as they cause base64 encoding errors
        if (typeof message === "object") {
          return;
        }

        this.sandbox.send({
          type: "output",
          output: Buffer.from(message).toString("base64"),
        });
      }
    } catch {
      // Silently fail to avoid breaking the log flow
      // console.error("Error forwarding log to sandbox:", error);
    }
  }

  /**
   * Open URL in default browser
   * @private
   * @param {string} url - URL to open
   */
  async _openBrowser(url) {
    try {
      // Use dynamic import for the 'open' package (ES module)
      const { default: open } = await import("open");

      // Open the browser
      await open(url, {
        wait: false,
      });
    } catch (error) {
      console.error("Failed to open browser automatically:", error);
      console.log(`Please manually open: ${url}`);
    }
  }

  /**
   * Initialize debugger server
   * @private
   */
  async _initializeDebugger() {
    // Import createDebuggerProcess at the module level if not already done
    const { createDebuggerProcess } = require("./agent/lib/debugger.js");

    // Only initialize once
    if (!this.agent.debuggerUrl) {
      const debuggerProcess = await createDebuggerProcess(
        this.config,
        this.emitter,
      );
      this.agent.debuggerUrl = debuggerProcess.url || null;
    }
  }

  /**
   * Render the sandbox in a browser window
   * @private
   * @param {Object} instance - Sandbox instance with connection details
   */
  _renderSandbox(instance) {
    if (!instance || !instance.ip || !instance.vncPort) {
      console.warn("Cannot render sandbox: missing instance connection details");
      return;
    }

    // Construct the VNC URL
    const url = `http://${instance.ip}:${instance.vncPort}/vnc_lite.html?token=V3b8wG9`;

    // Create data payload for the debugger
    const data = {
      resolution: this.config.TD_RESOLUTION,
      url: url,
      token: "V3b8wG9",
    };

    const encodedData = encodeURIComponent(JSON.stringify(data));

    // Use the debugger URL if available, otherwise fall back to default port
    const debuggerBaseUrl = this.agent.debuggerUrl || "http://localhost:3000";
    const urlToOpen = `${debuggerBaseUrl}?data=${encodedData}`;

    // Emit the showWindow event
    this.emitter.emit(events.showWindow, urlToOpen);
  }

  // ====================================
  // AI Methods (Exploratory Loop)
  // ====================================

  /**
   * Execute a natural language task using AI
   * This is the SDK equivalent of the CLI's exploratory loop
   * 
   * @param {string} task - Natural language description of what to do
   * @param {Object} options - Execution options
   * @param {boolean} [options.validateAndLoop=false] - Whether to validate completion and retry if incomplete
   * @returns {Promise<string|void>} Final AI response if validateAndLoop is true
   * 
   * @example
   * // Simple execution
   * await client.ai('Click the submit button');
   * 
   * @example
   * // With validation loop
   * const result = await client.ai('Fill out the contact form', { validateAndLoop: true });
   * console.log(result); // AI's final assessment
   */
  async ai(task) {
    this._ensureConnected();

    this.analytics.track("sdk.ai", { task });

    // Use the agent's exploratoryLoop method directly
    return await this.agent.exploratoryLoop(task, false, true, false);
  }
}

module.exports = TestDriverSDK;
module.exports.Element = Element;
