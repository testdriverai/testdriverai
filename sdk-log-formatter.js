const chalk = require("chalk");

/**
 * AWESOME Log formatter for TestDriver SDK 🎨
 * Provides beautiful, emoji-rich formatting with great DX for logs sent to dashcam
 * ANSI codes are preserved through the log pipeline: SDK → sandbox → /tmp/testdriver.log → dashcam
 *
 * Now with full UTF-8 and emoji support! 🚀
 */

// Duration threshold configurations for different contexts
const DURATION_THRESHOLDS = {
  default: { fast: 3000, medium: 10000 },
  action: { fast: 100, medium: 500 },
  redraw: { fast: 5000, medium: 10000 },
  quickAction: { fast: 50, medium: 200 },
  test: { fast: 1000, medium: 5000 },
};

class SDKLogFormatter {
  constructor(options = {}) {
    this.testContext = {
      currentTest: null,
      currentFile: null,
      startTime: null,
    };
    this.eventCount = 0;
    this.useColors = options.colors !== false;
    this.useEmojis = options.emojis !== false;
  }

  /**
   * Set the current test context from Vitest
   * @param {Object} context - Test context with file, test name, etc.
   */
  setTestContext(context) {
    if (context.file) this.testContext.currentFile = context.file;
    if (context.test) this.testContext.currentTest = context.test;
    if (context.startTime) this.testContext.startTime = context.startTime;
  }

  /**
   * Get elapsed time since test start
   * @returns {string} Formatted elapsed time
   */
  getElapsedTime() {
    if (!this.testContext.startTime) return "";
    const elapsed = Date.now() - this.testContext.startTime;
    const seconds = (elapsed / 1000).toFixed(2);
    return `[${seconds}s]`;
  }

  /**
   * Add elapsed time to parts array if available
   * @param {Array} parts - Array to push time string to
   * @param {boolean} dim - Whether to dim the time string
   */
  addTimestamp(parts, dim = true) {
    const timeStr = this.getElapsedTime();
    if (timeStr) {
      parts.push(dim ? chalk.dim(timeStr) : timeStr);
    }
  }

  /**
   * Get color function based on duration and thresholds
   * @param {number} durationMs - Duration in milliseconds
   * @param {string} thresholdKey - Key from DURATION_THRESHOLDS
   * @returns {Function} Chalk color function
   */
  getDurationColor(durationMs, thresholdKey = "default") {
    const thresholds = DURATION_THRESHOLDS[thresholdKey] || DURATION_THRESHOLDS.default;
    if (durationMs < thresholds.fast) return chalk.green;
    if (durationMs < thresholds.medium) return chalk.yellow;
    return chalk.red;
  }

  /**
   * Format duration with appropriate color
   * @param {number|string} duration - Duration in ms
   * @param {string} thresholdKey - Key from DURATION_THRESHOLDS
   * @param {boolean} showSeconds - Show as seconds (true) or raw (false)
   * @returns {string} Formatted duration string
   */
  formatDurationColored(duration, thresholdKey = "default", showSeconds = true) {
    const durationMs = parseInt(duration);
    const color = this.getDurationColor(durationMs, thresholdKey);
    const display = showSeconds ? `(${(durationMs / 1000).toFixed(1)}s)` : `(${duration})`;
    return color(display);
  }

  /**
   * Join metadata parts with separator
   * @param {Array} metaParts - Array of metadata strings
   * @returns {string} Joined metadata string with separators
   */
  joinMetaParts(metaParts) {
    if (metaParts.length === 0) return "";
    return chalk.dim("·") + " " + metaParts.join(chalk.dim(" · "));
  }

  /**
   * Create an indented result line prefix (for child results)
   * @returns {string} Indented arrow prefix
   */
  getResultPrefix() {
    return "   " + chalk.dim("→");
  }

  /**
   * Format a nested action result line (scrolled, clicked, typed, pressed keys, etc.)
   * @param {string} message - The action message (e.g., "scrolled down 300px", "pressed keys: tab")
   * @param {number} durationMs - Duration in milliseconds
   * @returns {string} Formatted nested result line
   */
  formatNestedAction(message, durationMs) {
    return this.getResultPrefix() + " " + chalk.dim(message) + " " + this.formatDurationColored(durationMs);
  }

  /**
   * Format a redraw/idle wait completion line
   * @param {number} durationMs - Duration in milliseconds
   * @returns {string} Formatted redraw complete line
   */
  formatRedrawComplete(durationMs) {
    return this.formatNestedAction("flake protection", durationMs);
  }

  /**
   * Format a scroll action result
   * @param {string} direction - Scroll direction (up, down, left, right)
   * @param {number} amount - Scroll amount in pixels
   * @param {number} durationMs - Duration in milliseconds
   * @returns {string} Formatted scroll result line
   */
  formatScrollResult(direction, amount, durationMs) {
    return this.formatNestedAction(`scrolled ${direction} ${amount}px`, durationMs);
  }

  /**
   * Format a click action result
   * @param {string} button - Button type (left, right, middle)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} durationMs - Duration in milliseconds
   * @returns {string} Formatted click result line
   */
  formatClickResult(button, x, y, durationMs) {
    return this.formatNestedAction(`click ${button} clicking at ${x}, ${y}`, durationMs);
  }

  /**
   * Format a type action result
   * @param {string} text - Text that was typed (or "****" for secrets)
   * @param {boolean} isSecret - Whether the text is a secret
   * @param {number} durationMs - Duration in milliseconds
   * @returns {string} Formatted type result line
   */
  formatTypeResult(text, isSecret, durationMs) {
    const displayText = isSecret ? "secret ****" : `"${text}"`;
    return this.formatNestedAction(`typed ${displayText}`, durationMs);
  }

  /**
   * Format a press keys action result
   * @param {string} keysDisplay - Keys that were pressed (comma-separated)
   * @param {number} durationMs - Duration in milliseconds
   * @returns {string} Formatted press keys result line
   */
  formatPressKeysResult(keysDisplay, durationMs) {
    return this.formatNestedAction(`pressed keys: ${keysDisplay}`, durationMs);
  }

  /**
   * Format a nested code display line (for exec commands)
   * @param {string} codeDisplay - The code to display
   * @returns {string} Formatted code line
   */
  formatCodeLine(codeDisplay) {
    return this.getResultPrefix() + " " + chalk.dim(codeDisplay);
  }

  /**
   * Format an exec complete result
   * @param {number} exitCode - The exit code
   * @param {number} durationMs - Duration in milliseconds
   * @returns {string} Formatted exec result line
   */
  formatExecComplete(exitCode, durationMs) {
    const statusText = exitCode !== 0 
      ? `failed (exit code ${exitCode})` 
      : `complete (exit code 0)`;
    const statusColor = exitCode !== 0 ? chalk.red : chalk.green;
    
    return this.formatResultLine(
      statusText, 
      statusColor, 
      { duration: durationMs }, 
      "action"
    );
  }

  /**
   * Format a log message in Vitest style
   * @param {string} type - Log type (info, success, error, action, debug)
   * @param {string} message - The message to format
   * @param {Object} meta - Additional metadata
   * @returns {string} Formatted log message
   */
  format(type, message, meta = {}) {
    this.eventCount++;

    const parts = [];

    // Add timestamp/elapsed time
    this.addTimestamp(parts, false);

    // Add type prefix with color
    const prefix = this.getPrefix(type);
    if (prefix) parts.push(prefix);

    // Add message
    parts.push(this.formatMessage(type, message));

    // Add metadata if present
    if (meta.duration) {
      parts.push(chalk.dim(`(${meta.duration})`));
    }

    return parts.join(" ");
  }

  /**
   * Get prefix for log type with AWESOME colors and emojis 🎨
   * @param {string} type - Log type
   * @returns {string} Colored prefix with emoji
   */
  getPrefix(type) {
    if (!this.useEmojis) {
      // Fallback to simple symbols without emojis
      const simplePrefixes = {
        info: chalk.blue("ℹ"),
        success: chalk.green("✓"),
        error: chalk.red("✖"),
        action: chalk.cyan("→"),
        debug: chalk.gray("⚙"),
        find: chalk.magenta("⌕"),
        click: chalk.cyan("▸"),
        type: chalk.yellow("⌨"),
        assert: chalk.green("✓"),
        scroll: chalk.blue("↕"),
        hover: chalk.cyan("→"),
        wait: chalk.yellow("⏱"),
        connect: chalk.green("⚡"),
        disconnect: chalk.red("⏹"),
      };
      return simplePrefixes[type] || chalk.gray("•");
    }

    const prefixes = {
      // Core actions - hand gestures
      info: chalk.blue("ℹ️"),
      success: chalk.green("✅"),
      error: chalk.red("❌"),
      warning: chalk.yellow("⚠️"),

      // Finding elements
      find: chalk.magenta("🔍"),
      findAll: chalk.magenta("🔎"),

      // Mouse actions
      click: chalk.cyan("👆"),
      doubleClick: chalk.cyan("👆👆"),
      rightClick: chalk.cyan("🖱️"),
      hover: chalk.cyan("👉"),
      drag: chalk.cyan("✊"),

      // Keyboard actions
      type: chalk.yellow("⌨️ "),
      pressKeys: chalk.yellow("🎹"),

      // Navigation
      scroll: chalk.blue("📜"),
      scrollUp: chalk.blue("⬆️"),
      scrollDown: chalk.blue("⬇️"),
      navigate: chalk.blue("🧭"),

      // Validation
      assert: chalk.green("✅"),
      verify: chalk.green("🔍"),
      extract: chalk.blue("🧠"),

      // System
      connect: chalk.green("🔌"),
      disconnect: chalk.red("🔌"),
      screenshot: chalk.blue("📸"),
      wait: chalk.yellow("⏳"),

      // Focus & Windows
      focusApplication: chalk.cyan("🎯"),

      // Cache
      cacheHit: chalk.yellow("⚡"),
      cacheMiss: chalk.gray("💤"),

      // Debug
      debug: chalk.gray("🔧"),

      // Default
      action: chalk.cyan("▶️ "),
    };
    return prefixes[type] || chalk.gray("•");
  }

  /**
   * Format the message content with appropriate styling
   * @param {string} type - Log type
   * @param {string} message - Raw message
   * @returns {string} Formatted message
   */
  formatMessage(type, message) {
    if (!this.useColors) return message;

    const formatters = {
      success: (msg) => chalk.green(msg),
      error: (msg) => chalk.red(msg),
      debug: (msg) => chalk.dim(msg),
    };

    return formatters[type] ? formatters[type](message) : message;
  }

  /**
   * Format a "finding" style message (when search starts) 🔍
   * @param {string} prefixType - Prefix type for getPrefix
   * @param {string} label - Action label (e.g., "Finding", "Finding All", "Asserting")
   * @param {string} description - Element/assertion description
   * @returns {string} Formatted message
   */
  formatFindingStyle(prefixType, label, description) {
    const parts = [];
    this.addTimestamp(parts);
    parts.push(this.getPrefix(prefixType));
    parts.push(chalk.bold.cyan(label));
    parts.push(chalk.cyan(`"${description}"`));
    return parts.join(" ");
  }

  /**
   * Format an element finding message (when search starts) 🔍
   * @param {string} description - Element description
   * @returns {string} Formatted message
   */
  formatElementFinding(description) {
    return this.formatFindingStyle("find", "Finding", description);
  }

  /**
   * Build common metadata parts for result messages
   * @param {Object} meta - Metadata object
   * @param {string} thresholdKey - Duration threshold key
   * @returns {Array} Array of formatted metadata strings
   */
  buildResultMetaParts(meta, thresholdKey = "default") {
    const metaParts = [];
    
    if (meta.x !== undefined && meta.y !== undefined) {
      metaParts.push(chalk.dim.gray(`📍 (${meta.x}, ${meta.y})`));
    }
    if (meta.selectorId && meta.consoleUrl) {
      const cacheUrl = `${meta.consoleUrl}/cache/${meta.selectorId}`;
      metaParts.push(chalk.blue.underline(cacheUrl));
    }
    if (meta.error) {
      metaParts.push(chalk.dim.red(meta.error));
    }
    if (meta.cacheHit) {
      metaParts.push(chalk.bold.yellow("⚡ cached"));
    }
    // Duration always last
    if (meta.duration) {
      metaParts.push(this.formatDurationColored(meta.duration, thresholdKey));
    }
    
    return metaParts;
  }

  /**
   * Format a result line (indented child result)
   * @param {string} statusText - Status text (e.g., "found", "not found")
   * @param {Function} statusColor - Chalk color function for status
   * @param {Object} meta - Metadata object
   * @param {string} thresholdKey - Duration threshold key
   * @returns {string} Formatted result line
   */
  formatResultLine(statusText, statusColor, meta = {}, thresholdKey = "default") {
    const parts = [];
    this.addTimestamp(parts);
    parts.push(this.getResultPrefix());
    parts.push(statusColor(statusText));
    
    const metaParts = this.buildResultMetaParts(meta, thresholdKey);
    if (metaParts.length > 0) {
      parts.push(this.joinMetaParts(metaParts));
    }
    
    return parts.join(" ");
  }

  /**
   * Format an element found message with AWESOME styling 🎯
   * @param {string} description - Element description
   * @param {Object} meta - Element metadata (coordinates, duration, cache hit)
   * @returns {string} Formatted message
   */
  formatElementFound(description, meta = {}) {
    return this.formatResultLine("found", chalk.green, meta);
  }

  /**
   * Format an element not found message with styling ❌
   * @param {string} description - Element description
   * @param {Object} meta - Metadata (duration, error)
   * @returns {string} Formatted message
   */
  formatElementNotFound(description, meta = {}) {
    return this.formatResultLine("not found", chalk.red, meta);
  }

  /**
   * Format a finding all message (when search starts) 🔎
   * @param {string} description - Element description
   * @returns {string} Formatted message
   */
  formatElementsFinding(description) {
    return this.formatFindingStyle("findAll", "Finding All", description);
  }

  /**
   * Format a found all message with AWESOME styling 🎯
   * @param {string} description - Element description
   * @param {number} count - Number of elements found
   * @param {Object} meta - Metadata (duration, cache hit)
   * @returns {string} Formatted message
   */
  formatElementsFound(description, count, meta = {}) {
    const parts = [];
    this.addTimestamp(parts);
    parts.push(this.getResultPrefix());
    parts.push(chalk.green(`found ${count} elements`));

    const metaParts = [];
    if (meta.cacheHit) {
      metaParts.push(chalk.bold.yellow("⚡ cached"));
    }
    if (meta.duration) {
      metaParts.push(this.formatDurationColored(meta.duration));
    }

    if (metaParts.length > 0) {
      parts.push(this.joinMetaParts(metaParts));
    }

    return parts.join(" ");
  }

  /**
   * Format an asserting message (when assertion starts) ✓
   * @param {string} assertion - What is being asserted
   * @returns {string} Formatted message
   */
  formatAsserting(assertion) {
    return this.formatFindingStyle("assert", "Asserting", assertion);
  }
  /**
   * Format the assertion result as a subtask line
   * @param {boolean} passed - Whether assertion passed
   * @param {string} response - The AI response message
   * @param {number} durationMs - Duration in milliseconds
   * @returns {string} Formatted result line
   */
  formatAssertResult(passed, response, durationMs) {
    const parts = [];
    this.addTimestamp(parts);
    parts.push(this.getResultPrefix());
    
    if (passed) {
      parts.push(chalk.green("passed"));
    } else {
      parts.push(chalk.red("failed"));
    }
    
    // Add the response message (trimmed)
    if (response) {
      const trimmedResponse = response.trim().split('\n')[0]; // First line only
      parts.push(chalk.dim(trimmedResponse));
    }
    
    // Add duration
    if (durationMs) {
      parts.push(this.formatDurationColored(durationMs, "action"));
    }
    
    return parts.join(" ");
  }

  // Action color mapping (shared between formatAction and formatActionComplete)
  static ACTION_COLORS = {
    click: chalk.bold.cyan,
    hover: chalk.bold.blue,
    type: chalk.bold.yellow,
    scroll: chalk.bold.magenta,
    assert: chalk.bold.green,
    wait: chalk.bold.yellow,
  };

  /**
   * Build action message parts (shared logic for formatAction and formatActionComplete)
   * @param {string} action - Action type
   * @param {string} description - Description or target
   * @returns {Array} Array of formatted parts
   */
  buildActionParts(action, description) {
    const parts = [];
    this.addTimestamp(parts);

    const actionKey = action.toLowerCase().replace(/\s+/g, "");
    parts.push(this.getPrefix(actionKey));

    const actionText = action.charAt(0).toUpperCase() + action.slice(1).toLowerCase();
    const colorFn = SDKLogFormatter.ACTION_COLORS[actionKey] || chalk.bold.white;
    parts.push(colorFn(actionText));

    if (description) {
      parts.push(chalk.cyan(`"${description}"`));
    }

    return { parts, actionKey };
  }

  /**
   * Format an action message with AWESOME emojis! 🎬
   * @param {string} action - Action type
   * @param {string} description - Description or target
   * @param {Object} meta - Action metadata
   * @returns {string} Formatted message
   */
  formatAction(action, description, meta = {}) {
    const { parts } = this.buildActionParts(action, description);

    const metaParts = [];
    if (meta.text) {
      metaParts.push(chalk.gray(`→ ${chalk.white(meta.text)}`));
    }
    if (meta.duration) {
      metaParts.push(chalk.dim(`⏱️  ${this.formatDurationColored(meta.duration, "quickAction", false)}`));
    }

    if (metaParts.length > 0) {
      parts.push(this.joinMetaParts(metaParts));
    }

    return parts.join(" ");
  }

  /**
   * Format an action complete message with separate action and redraw durations 🎬
   * @param {string} action - Action type
   * @param {string} description - Description or target
   * @param {Object} meta - Action metadata
   * @param {number} meta.actionDuration - Duration of the action itself in ms
   * @param {number} meta.redrawDuration - Duration of the redraw wait in ms
   * @param {boolean} meta.cacheHit - Whether cache was hit
   * @returns {string} Formatted message
   */
  formatActionComplete(action, description, meta = {}) {
    const { parts } = this.buildActionParts(action, description);

    const metaParts = [];
    
    if (meta.actionDuration !== undefined) {
      const durationMs = parseInt(meta.actionDuration);
      const durationSec = (durationMs / 1000).toFixed(1) + 's';
      const color = this.getDurationColor(durationMs, "action");
      metaParts.push(chalk.dim(`⚡ ${color(durationSec)}`));
    }
    
    if (meta.redrawDuration !== undefined) {
      const durationMs = parseInt(meta.redrawDuration);
      const durationSec = (durationMs / 1000).toFixed(1) + 's';
      const color = this.getDurationColor(durationMs, "redraw");
      metaParts.push(chalk.dim(`🔄 ${color(durationSec)}`));
    }
    
    if (meta.cacheHit) {
      metaParts.push(chalk.bold.yellow("⚡ cached"));
    }

    if (metaParts.length > 0) {
      parts.push(this.joinMetaParts(metaParts));
    }

    return parts.join(" ");
  }

  /**
   * Format an assertion message with beautiful status indicators 🎯
   * @param {string} assertion - What is being asserted
   * @param {boolean} passed - Whether assertion passed
   * @param {Object} meta - Assertion metadata
   * @returns {string} Formatted message
   */
  formatAssertion(assertion, passed, meta = {}) {
    const parts = [];
    this.addTimestamp(parts);

    if (passed) {
      parts.push(this.getPrefix("success"));
      parts.push(chalk.bold.green("Assert"));
      parts.push(chalk.cyan(`"${assertion}"`));
      parts.push(chalk.dim("·"));
      parts.push(chalk.bold.green("✓ PASSED"));
    } else {
      parts.push(this.getPrefix("error"));
      parts.push(chalk.bold.red("Assert"));
      parts.push(chalk.cyan(`"${assertion}"`));
      parts.push(chalk.dim("·"));
      parts.push(chalk.bold.red("✗ FAILED"));
    }

    if (meta.duration) {
      parts.push(chalk.dim("·"));
      parts.push(chalk.dim(`⏱️  ${this.formatDurationColored(meta.duration, "action", false)}`));
    }

    return parts.join(" ");
  }

  /**
   * Format an error message with clear visual indicators 🚨
   * @param {string} message - Error message
   * @param {Error} error - Error object
   * @returns {string} Formatted error
   */
  formatError(message, error) {
    const parts = [];
    this.addTimestamp(parts);
    parts.push(this.getPrefix("error"));
    parts.push(chalk.red.bold(message));

    if (error && error.message) {
      parts.push(chalk.dim("→"));
      parts.push(chalk.red(error.message));
    }

    return parts.join(" ");
  }

  /**
   * Format a connection/disconnection message 🔌
   * @param {string} type - 'connect' or 'disconnect'
   * @param {Object} meta - Connection metadata
   * @returns {string} Formatted message
   */
  formatConnection(type, meta = {}) {
    const parts = [];
    this.addTimestamp(parts);
    parts.push(this.getPrefix(type));

    if (type === "connect") {
      parts.push(chalk.bold.green("Connected"));
      if (meta.sandboxId) {
        parts.push(chalk.dim("·"));
        parts.push(chalk.cyan(`Sandbox: ${meta.sandboxId}`));
      }
      if (meta.os) {
        parts.push(chalk.dim("·"));
        parts.push(chalk.gray(`OS: ${meta.os}`));
      }
    } else {
      parts.push(chalk.bold.yellow("Disconnected"));
    }

    return parts.join(" ");
  }

  /**
   * Format a screenshot message 📸
   * @param {Object} meta - Screenshot metadata
   * @returns {string} Formatted message
   */
  formatScreenshot(meta = {}) {
    const parts = [];
    this.addTimestamp(parts);
    parts.push(this.getPrefix("screenshot"));
    parts.push(chalk.bold.blue("Screenshot"));

    if (meta.path) {
      parts.push(chalk.dim("·"));
      parts.push(chalk.cyan(meta.path));
    }

    if (meta.size) {
      parts.push(chalk.dim("·"));
      parts.push(chalk.gray(`${meta.size}`));
    }

    return parts.join(" ");
  }

  /**
   * Format a cache status message ⚡
   * @param {boolean} hit - Whether it was a cache hit
   * @param {Object} meta - Cache metadata
   * @returns {string} Formatted message
   */
  formatCacheStatus(hit, meta = {}) {
    const parts = [];
    parts.push(this.getPrefix(hit ? "cacheHit" : "cacheMiss"));

    if (hit) {
      parts.push(chalk.bold.yellow("Cache HIT"));
      if (meta.similarity !== undefined) {
        const similarity = (meta.similarity * 100).toFixed(1);
        parts.push(chalk.dim("·"));
        parts.push(chalk.green(`${similarity}% similar`));
      }
    } else {
      parts.push(chalk.dim.gray("Cache MISS"));
    }

    if (meta.strategy) {
      parts.push(chalk.dim("·"));
      parts.push(chalk.gray(meta.strategy));
    }

    return parts.join(" ");
  }

  /**
   * Create a beautiful section header with box drawing 📦
   * @param {string} title - Section title
   * @param {string} emoji - Optional emoji to prefix
   * @returns {string} Formatted header
   */
  formatHeader(title, emoji = "✨") {
    const width = Math.min(60, Math.max(title.length + 4, 40));
    const topLine = chalk.dim("╭" + "─".repeat(width - 2) + "╮");
    const titleLine =
      `${chalk.dim("│")} ${emoji} ${chalk.bold.white(title)}`.padEnd(width + 20) + chalk.dim("│");
    const bottomLine = chalk.dim("╰" + "─".repeat(width - 2) + "╯");
    return `\n${topLine}\n${titleLine}\n${bottomLine}\n`;
  }

  /**
   * Format a simple divider
   * @param {string} char - Character to use for divider
   * @returns {string} Formatted divider
   */
  formatDivider(char = "─") {
    return chalk.dim(char.repeat(60));
  }

  /**
   * Format a beautiful summary line with stats 📊
   * @param {Object} stats - Test statistics
   * @returns {string} Formatted summary
   */
  formatSummary(stats) {
    const parts = [];

    if (stats.passed > 0) {
      parts.push(chalk.bold.green(`✓ ${stats.passed} passed`));
    }
    if (stats.failed > 0) {
      parts.push(chalk.bold.red(`✗ ${stats.failed} failed`));
    }
    if (stats.skipped > 0) {
      parts.push(chalk.yellow(`⊘ ${stats.skipped} skipped`));
    }
    if (stats.total > 0) {
      parts.push(chalk.dim(`${stats.total} total`));
    }
    if (stats.duration) {
      parts.push(chalk.dim(`⏱️  ${stats.duration}`));
    }

    const divider = this.formatDivider();
    const separator = chalk.dim(" │ ");
    return `\n${divider}\n${parts.join(separator)}\n${divider}\n`;
  }

  /**
   * Format a progress indicator 📈
   * @param {number} current - Current step
   * @param {number} total - Total steps
   * @param {string} message - Progress message
   * @returns {string} Formatted progress
   */
  formatProgress(current, total, message = "") {
    const percentage = Math.round((current / total) * 100);
    const barWidth = 20;
    const filled = Math.round((current / total) * barWidth);
    const empty = barWidth - filled;

    const bar = chalk.green("█".repeat(filled)) + chalk.dim("░".repeat(empty));
    const stats = chalk.dim(`${current}/${total}`);

    const parts = [
      chalk.bold("Progress"),
      bar,
      chalk.cyan(`${percentage}%`),
      stats,
    ];

    if (message) {
      parts.push(chalk.dim("·"));
      parts.push(chalk.gray(message));
    }

    return parts.join(" ");
  }

  /**
   * Format a waiting/loading message ⏳
   * @param {string} message - What we're waiting for
   * @param {number} elapsed - Elapsed time in ms
   * @returns {string} Formatted waiting message
   */
  formatWaiting(message, elapsed) {
    const parts = [];
    parts.push(this.getPrefix("wait"));
    parts.push(chalk.bold.yellow("Waiting"));
    parts.push(chalk.cyan(message));

    if (elapsed) {
      const seconds = (elapsed / 1000).toFixed(1);
      parts.push(chalk.dim("·"));
      parts.push(chalk.gray(`${seconds}s`));
    }

    return parts.join(" ");
  }

  /**
   * Format test start message 🚀
   * @param {string} testName - Name of the test
   * @returns {string} Formatted test start
   */
  formatTestStart(testName) {
    return `\n${chalk.bold.cyan("▶️  Running:")} ${chalk.white(testName)}\n`;
  }

  /**
   * Format test end message with result 🏁
   * @param {string} testName - Name of the test
   * @param {boolean} passed - Whether test passed
   * @param {number} duration - Test duration in ms
   * @returns {string} Formatted test end
   */
  formatTestEnd(testName, passed, duration) {
    const parts = [];

    if (passed) {
      parts.push(chalk.bold.green("✅ PASSED"));
    } else {
      parts.push(chalk.bold.red("❌ FAILED"));
    }

    parts.push(chalk.white(testName));

    if (duration) {
      const seconds = (duration / 1000).toFixed(2);
      const color = this.getDurationColor(duration, "test");
      parts.push(chalk.dim("·"));
      parts.push(color(`${seconds}s`));
    }

    return `\n${parts.join(" ")}\n`;
  }
}

// Export singleton instance
const formatter = new SDKLogFormatter();

module.exports = {
  SDKLogFormatter,
  formatter,
};
