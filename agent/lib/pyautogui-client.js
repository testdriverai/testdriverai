const WebSocket = require('ws');
const { EventEmitter } = require('events');

/**
 * Async Node.js interface for PyAutoGUI commands via WebSocket
 */
class PyAutoGUIClient extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.requestId = 0;
    this.ps = {};
    this.keepaliveInterval = null;
    this.keepaliveTimeout = 5000;
    this.connectionId = Math.random()
      .toString(36)
      .substring(2, 15); // Generate unique connection ID
  }

  /**
   * Helper method to format log messages with connection ID
   */
  _log(level, message, ...args) {
    // eslint-disable-next-line no-unused-vars
    const prefix = `[PyAutoGUIClient:${this.connectionId}]`;
    // Logging disabled for CLI usage
    // console.log(prefix, message, ...args);
  }

  /**
   * Connect to the PyAutoGUI WebSocket server
   */
  async connect() {
    const maxRetries = 30;
    const retryDelay = 1000; // 1 second

    return new Promise((resolve, reject) => {
      let attempts = 0;
      let retryTimer = null;

      const cleanup = () => {
        if (retryTimer) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
      };

      const tryConnect = () => {
        // Clean up any existing timer
        cleanup();

        this._log('info', 'Connecting to PyAutoGUI server at: %s (attempt %d)', this.url, attempts + 1);

        // Clean up any existing WebSocket connection
        if (this.ws) {
          this.ws.removeAllListeners();
          if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
            this.ws.close();
          }
          this.ws = null;
        }

        this._log('info', 'Creating new WebSocket instance');
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
          this._log('info', 'WebSocket connection opened');
          this.connected = true;
          cleanup();
          this.emit('connected');
          this.startKeepalive();
          resolve();
        });

        this.ws.on('message', raw => {
          this._log('debug', 'Received message length: %s', raw.length);
          let data;
          try {
            data = JSON.parse(raw);
          } catch (e) {
            this._log('error', 'Failed to parse message: %j, %o', raw, e);
            return;
          }

          // Use requestId from data.originalData to resolve the correct promise
          const requestId = data.originalData && data.originalData.requestId;
          if (requestId && this.ps[requestId]) {
            this._log(
              'debug',
              'Resolving promise for requestId: %s',
              requestId
            );
            this.ps[requestId].resolve(data.result);
            delete this.ps[requestId];
          } else {
            this._log('warn', 'Unhandled data: %j', data);
          }
        });

        this.ws.on('pong', data => {
          this._log('debug', 'Received pong frame: %j', data.toString());
        });

        this.ws.on('error', error => {
          this._log('error', 'WebSocket error: %o', error);
          this.connected = false;
          this.stopKeepalive();
          this.emit('error', error);

          attempts++;
          if (attempts < maxRetries) {
            this._log(
              'error',
              'Failed to connect, retrying: %s (attempt %s)',
              this.url,
              attempts
            );
            // Use setImmediate to break the call stack instead of setTimeout
            retryTimer = setTimeout(() => {
              // Use setImmediate to ensure we don't build up call stack
              setImmediate(tryConnect);
            }, retryDelay);
          } else {
            this._log('error', 'Max retries reached, giving up.');
            cleanup();
            reject(
              new Error(
                'Failed to connect to PyAutoGUI server after multiple attempts'
              )
            );
          }
        });

        this.ws.on('close', (code, reason) => {
          this._log('warn', 'WebSocket connection closed: %j', {
            code,
            reason,
            connected: this.connected,
            attempts,
            url: this.url
          });
          this.connected = false;
          this.stopKeepalive();
          this.emit('disconnected');
        });
      };

      tryConnect();
    });
  }

  /**
   * Send a command and wait for response
   */
  async sendCommand(command, data = {}) {
    let resolvePromise;
    if (!this.connected) {
      this._log(
        'warn',
        'Trying to send command while not connected: %s, %j',
        command,
        data
      );
    }
    this.requestId++;
    const commandData = { command, data, requestId: this.requestId };

    this._log('debug', 'Sending command: %j', commandData);

    let p = new Promise(resolve => {
      this.ws.send(JSON.stringify(commandData));
      resolvePromise = resolve;
    });
    this.ps[this.requestId] = {
      promise: p,
      resolve: resolvePromise,
      message: commandData
    };
    return p;
  }

  /**
   * Mouse movement commands
   */
  async moveTo(x, y) {
    return this.sendCommand('move', { x, y });
  }

  async moveRel(x, y) {
    return this.sendCommand('moverel', { x, y });
  }

  /**
   * Mouse click commands
   */
  async click(x = null, y = null, button = 'left') {
    const data = { button };
    if (x !== null) {
      data.x = x;
    }
    if (y !== null) {
      data.y = y;
    }
    return this.sendCommand('click', data);
  }

  async mouseDown(x = null, y = null, button = 'left') {
    const data = { button };
    if (x !== null) {
      data.x = x;
    }
    if (y !== null) {
      data.y = y;
    }
    return this.sendCommand('mousedown', data);
  }

  async mouseUp(x = null, y = null, button = 'left') {
    const data = { button };
    if (x !== null) {
      data.x = x;
    }
    if (y !== null) {
      data.y = y;
    }
    return this.sendCommand('mouseup', data);
  }

  async rightClick(x = null, y = null) {
    const data = {};
    if (x !== null) {
      data.x = x;
    }
    if (y !== null) {
      data.y = y;
    }
    return this.sendCommand('rightclick', data);
  }

  async middleClick(x = null, y = null) {
    const data = {};
    if (x !== null) {
      data.x = x;
    }
    if (y !== null) {
      data.y = y;
    }
    return this.sendCommand('middleclick', data);
  }

  async doubleClick(x = null, y = null) {
    const data = {};
    if (x !== null) {
      data.x = x;
    }
    if (y !== null) {
      data.y = y;
    }
    return this.sendCommand('doubleclick', data);
  }

  async tripleClick(x = null, y = null) {
    const data = {};
    if (x !== null) {
      data.x = x;
    }
    if (y !== null) {
      data.y = y;
    }
    return this.sendCommand('tripleclick', data);
  }

  /**
   * Scroll command
   */
  async scroll(amount) {
    return this.sendCommand('scroll', { amount });
  }

  /**
   * Keyboard commands
   */
  async write(text) {
    return this.sendCommand('write', { text });
  }

  async press(key) {
    return this.sendCommand('press', { key });
  }

  async hotkey(...keys) {
    return this.sendCommand('hotkey', { keys });
  }

  async keyDown(key) {
    return this.sendCommand('keydown', { key });
  }

  async keyUp(key) {
    return this.sendCommand('keyup', { key });
  }

  /**
   * Screenshot command - returns base64 encoded PNG
   */
  async screenshot() {
    let screenshotREsponse = await this.sendCommand('screenshot');
    return screenshotREsponse;
  }

  /**
   * Execute PowerShell command - returns exec result object
   */
  async exec(command, timeout = 60 * 5) {
    let result = await this.sendCommand('exec', { command, timeout });
    return result;
  }

  /**
   * Alert command
   */
  async alert(text) {
    return this.sendCommand('alert', { text });
  }
  async ping() {
    return this.sendCommand('ping');
  }

  /**
   * Configure keepalive settings
   */
  setKeepaliveTimeout(timeout) {
    this.keepaliveTimeout = timeout;
    this._log('info', 'Keepalive timeout set to:', timeout, 'ms');

    // Restart keepalive with new timeout if already running
    if (this.keepaliveInterval && this.connected) {
      this.stopKeepalive();
      this.startKeepalive();
    }
  }

  /**
   * Start keepalive mechanism
   */
  startKeepalive() {
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
    }

    this.keepaliveInterval = setInterval(() => {
      if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this._log('debug', 'Sending keepalive ping');
          this.ws.ping();
        } catch (error) {
          this._log('warn', 'Keepalive ping failed:', error);
          // Don't immediately disconnect, let the WebSocket error handling deal with it
        }
      }
    }, this.keepaliveTimeout);

    this._log(
      'info',
      'Keepalive started with interval:',
      this.keepaliveTimeout,
      'ms'
    );
  }

  /**
   * Stop keepalive mechanism
   */
  stopKeepalive() {
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
      this._log('debug', 'Keepalive stopped');
    }
  }

  /**
   * Disconnect from the server
   */
  disconnect() {
    this.stopKeepalive();
    if (this.ws) {
      this._log('info', 'Disconnecting WebSocket');
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }
}

module.exports = { PyAutoGUIClient };
