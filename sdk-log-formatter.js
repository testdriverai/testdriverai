const chalk = require('chalk');

/**
 * Log formatter for TestDriver SDK
 * Provides clean, Vitest-style formatting for logs sent to dashcam
 * ANSI codes are preserved through the log pipeline: SDK → sandbox → /tmp/testdriver.log → dashcam
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
    if (!this.testContext.startTime) return '';
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
    
    return parts.join(' ');
  }

  /**
   * Get prefix for log type with colors and emojis
   * @param {string} type - Log type
   * @returns {string} Colored prefix
   */
  getPrefix(type) {
    const prefixes = {
      info: chalk.blue('ℹ'),
      success: chalk.green('✓'),
      error: chalk.red('✖'),
      action: chalk.cyan('→'),
      debug: chalk.gray('⚙'),
      find: chalk.magenta('🔍'),
      click: chalk.cyan('👆'),
      type: chalk.yellow('⌨'),
      assert: chalk.green('✓'),
      scroll: chalk.blue('↕'),
      hover: chalk.cyan('👉'),
    };
    return prefixes[type] || chalk.gray('•');
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
   * Format an element found message
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
    parts.push(this.getPrefix('find'));
    
    // Main message with emphasis
    parts.push(chalk.bold('Found'));
    parts.push(chalk.cyan(`"${description}"`));
    
    // Metadata on same line with subtle styling
    const metaParts = [];
    if (meta.x !== undefined && meta.y !== undefined) {
      metaParts.push(chalk.dim(`at (${meta.x}, ${meta.y})`));
    }
    if (meta.duration) {
      metaParts.push(chalk.dim(meta.duration));
    }
    if (meta.cacheHit) {
      metaParts.push(chalk.yellow('⚡ cached'));
    }
    
    if (metaParts.length > 0) {
      parts.push(metaParts.join(' '));
    }
    
    return parts.join('  ');
  }

  /**
   * Format an action message (click, type, scroll, etc.)
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
    parts.push(this.getPrefix(action.toLowerCase()));
    
    // Action text with emphasis
    const actionText = action.charAt(0).toUpperCase() + action.slice(1).toLowerCase();
    parts.push(chalk.bold(actionText));
    
    // Target with color
    if (description) {
      parts.push(chalk.cyan(`"${description}"`));
    }
    
    // Additional metadata
    const metaParts = [];
    if (meta.text) {
      metaParts.push(chalk.gray(`→ ${meta.text}`));
    }
    if (meta.duration) {
      metaParts.push(chalk.dim(meta.duration));
    }
    
    if (metaParts.length > 0) {
      parts.push(metaParts.join(' '));
    }
    
    return parts.join('  ');
  }

  /**
   * Format an assertion message
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
      parts.push(chalk.green('✓'));
      parts.push(chalk.bold('Assert'));
      parts.push(chalk.cyan(`"${assertion}"`));
      parts.push(chalk.green('PASSED'));
    } else {
      parts.push(chalk.red('✖'));
      parts.push(chalk.bold('Assert'));
      parts.push(chalk.cyan(`"${assertion}"`));
      parts.push(chalk.red('FAILED'));
    }
    
    if (meta.duration) {
      parts.push(chalk.dim(meta.duration));
    }
    
    return parts.join('  ');
  }

  /**
   * Format an error message
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
    
    parts.push(chalk.red('✖'));
    parts.push(chalk.red(chalk.bold(message)));
    
    if (error && error.message) {
      parts.push(chalk.red(`→ ${error.message}`));
    }
    
    return parts.join('  ');
  }

  /**
   * Create a section header
   * @param {string} title - Section title
   * @returns {string} Formatted header
   */
  formatHeader(title) {
    const line = chalk.dim('─'.repeat(Math.min(50, title.length + 4)));
    return `\n${line}\n${chalk.bold(title)}\n${line}`;
  }

  /**
   * Format a summary line
   * @param {Object} stats - Test statistics
   * @returns {string} Formatted summary
   */
  formatSummary(stats) {
    const parts = [];
    
    if (stats.passed > 0) {
      parts.push(chalk.green(`${stats.passed} passed`));
    }
    if (stats.failed > 0) {
      parts.push(chalk.red(`${stats.failed} failed`));
    }
    if (stats.total > 0) {
      parts.push(chalk.dim(`${stats.total} total`));
    }
    if (stats.duration) {
      parts.push(chalk.dim(stats.duration));
    }
    
    return parts.join(chalk.dim(' | '));
  }
}

// Export singleton instance
const formatter = new SDKLogFormatter();

module.exports = {
  SDKLogFormatter,
  formatter,
};
