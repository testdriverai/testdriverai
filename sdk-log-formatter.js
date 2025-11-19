const chalk = require("chalk");

/**
 * AWESOME Log formatter for TestDriver SDK 🎨
 * Provides beautiful, emoji-rich formatting with great DX for logs sent to dashcam
 * ANSI codes are preserved through the log pipeline: SDK → sandbox → /tmp/testdriver.log → dashcam
 *
 * Now with full UTF-8 and emoji support! 🚀
 */

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
    const timeStr = this.getElapsedTime();
    if (timeStr) parts.push(timeStr);

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
      type: chalk.yellow("⌨️"),
      pressKeys: chalk.yellow("🎹"),

      // Navigation
      scroll: chalk.blue("📜"),
      scrollUp: chalk.blue("⬆️"),
      scrollDown: chalk.blue("⬇️"),
      navigate: chalk.blue("🧭"),

      // Validation
      assert: chalk.green("✅"),
      verify: chalk.green("🔍"),
      remember: chalk.blue("🧠"),

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
      action: chalk.cyan("▶️"),
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
   * Format an element found message with AWESOME styling 🎯
   * @param {string} description - Element description
   * @param {Object} meta - Element metadata (coordinates, duration, cache hit)
   * @returns {string} Formatted message
   */
  formatElementFound(description, meta = {}) {
    const parts = [];

    // Time and icon on same line
    const timeStr = this.getElapsedTime();
    if (timeStr) {
      parts.push(chalk.dim(timeStr));
    }
    parts.push(this.getPrefix("find"));

    // Main message with emphasis
    parts.push(chalk.bold.green("Found"));
    parts.push(chalk.cyan(`"${description}"`));

    // Metadata on same line with subtle styling
    const metaParts = [];
    if (meta.x !== undefined && meta.y !== undefined) {
      metaParts.push(chalk.dim.gray(`📍 (${meta.x}, ${meta.y})`));
    }
    if (meta.duration) {
      const durationMs = parseInt(meta.duration);
      const durationColor =
        durationMs < 100
          ? chalk.green
          : durationMs < 500
            ? chalk.yellow
            : chalk.red;
      metaParts.push(chalk.dim(`⏱️  ${durationColor(meta.duration)}`));
    }
    if (meta.cacheHit) {
      metaParts.push(chalk.bold.yellow("⚡ cached"));
    }

    if (metaParts.length > 0) {
      parts.push(chalk.dim("·"));
      parts.push(metaParts.join(chalk.dim(" · ")));
    }

    return parts.join(" ");
  }

  /**
   * Format an action message with AWESOME emojis! 🎬
   * @param {string} action - Action type
   * @param {string} description - Description or target
   * @param {Object} meta - Action metadata
   * @returns {string} Formatted message
   */
  formatAction(action, description, meta = {}) {
    const parts = [];

    // Time and icon
    const timeStr = this.getElapsedTime();
    if (timeStr) {
      parts.push(chalk.dim(timeStr));
    }

    // Use action-specific prefix
    const actionKey = action.toLowerCase().replace(/\s+/g, "");
    parts.push(this.getPrefix(actionKey));

    // Action text with emphasis and color coding
    const actionText =
      action.charAt(0).toUpperCase() + action.slice(1).toLowerCase();
    const actionColors = {
      click: chalk.bold.cyan,
      hover: chalk.bold.blue,
      type: chalk.bold.yellow,
      scroll: chalk.bold.magenta,
      assert: chalk.bold.green,
      wait: chalk.bold.yellow,
    };
    const colorFn = actionColors[actionKey] || chalk.bold.white;
    parts.push(colorFn(actionText));

    // Target with color
    if (description) {
      parts.push(chalk.cyan(`"${description}"`));
    }

    // Additional metadata
    const metaParts = [];
    if (meta.text) {
      metaParts.push(chalk.gray(`→ ${chalk.white(meta.text)}`));
    }
    if (meta.duration) {
      const durationMs = parseInt(meta.duration);
      const durationColor =
        durationMs < 50
          ? chalk.green
          : durationMs < 200
            ? chalk.yellow
            : chalk.red;
      metaParts.push(chalk.dim(`⏱️  ${durationColor(meta.duration)}`));
    }

    if (metaParts.length > 0) {
      parts.push(chalk.dim("·"));
      parts.push(metaParts.join(chalk.dim(" · ")));
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

    // Time and icon
    const timeStr = this.getElapsedTime();
    if (timeStr) {
      parts.push(chalk.dim(timeStr));
    }

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
      const durationMs = parseInt(meta.duration);
      const durationColor =
        durationMs < 100
          ? chalk.green
          : durationMs < 500
            ? chalk.yellow
            : chalk.red;
      parts.push(chalk.dim("·"));
      parts.push(chalk.dim(`⏱️  ${durationColor(meta.duration)}`));
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

    const timeStr = this.getElapsedTime();
    if (timeStr) {
      parts.push(chalk.dim(timeStr));
    }

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

    const timeStr = this.getElapsedTime();
    if (timeStr) {
      parts.push(chalk.dim(timeStr));
    }

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

    const timeStr = this.getElapsedTime();
    if (timeStr) {
      parts.push(chalk.dim(timeStr));
    }

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
      `${chalk.dim("│")} ${emoji} ${chalk.bold.white(title)}`.padEnd(
        width + 20,
      ) + chalk.dim("│");
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

    const separator = chalk.dim(" │ ");
    return `\n${chalk.dim("─".repeat(60))}\n${parts.join(separator)}\n${chalk.dim("─".repeat(60))}\n`;
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
      const durationColor =
        duration < 1000
          ? chalk.green
          : duration < 5000
            ? chalk.yellow
            : chalk.red;
      parts.push(chalk.dim("·"));
      parts.push(durationColor(`${seconds}s`));
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
