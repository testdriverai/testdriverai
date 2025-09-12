const WebSocket = require("ws");
const marky = require("marky");
const { events } = require("../events");
const { TD_API_ROOT } = require("./config");

const createSandbox = (emitter, analytics) => {
  class Sandbox {
    constructor() {
      this.socket = null;
      this.ps = {};
      this.heartbeat = null;
      this.apiSocketConnected = false;
      this.instanceSocketConnected = false;
      this.authenticated = false;
      this.instance = null;
      this.messageId = 0;
      this.uniqueId = Math.random().toString(36).substring(7);
    }

    send(message) {

      this.messageId++;

      console.log('original', message)

      // Store original type for timing before transformation
      const originalType = message.type;

      if (!this.socket?._socket?.remoteAddress.includes(TD_API_ROOT)) {
        // Unfortunately the api transforms the packets, so we need to remap them for direct connection
        
        let key = message.type.split('.')[1] || message.type;

        // Handle system commands that need special mapping
        if (message.type.startsWith('system.')) {
          if (key === 'screenshot') {
            message = { command: 'screenshot', data: {} };
          } else if (key === 'get-mouse-position') {
            message = { command: 'exec', data: { command: 'Add-Type -AssemblyName System.Windows.Forms; $p=[System.Windows.Forms.Cursor]::Position; Write-Output ("{""x"":$($p.X),""y"":$($p.Y)}")' } };
          } else if (key === 'get-active-window') {
            message = { command: 'get-active-window', data: {} };
          } else if (key === 'network') {
            message = { command: 'network', data: { name: message.name } };
          }
        }
        // Handle commands that need special exec mapping
        else if (message.type.startsWith('commands.')) {
          if (key === 'run') {
            message = { command: 'exec', data: { command: message.command, timeout: message.timeout } };
          } else if (key === 'focus-application') {
            message = { command: 'focus-window', data: { title: message.name, action: 'Focus' } };
          }
        }
        // Handle mouse/keyboard actions
        else if (['leftClick', 'rightClick', 'middleClick', 'doubleClick', 'tripleClick'].includes(message.type)) {
          const commandMap = {
            'leftClick': 'click',
            'rightClick': 'rightclick', 
            'middleClick': 'middleclick',
            'doubleClick': 'doubleclick',
            'tripleClick': 'tripleclick'
          };
          message = { command: commandMap[message.type], data: { x: message.x, y: message.y, button: message.button || 'left' } };
        }
        else if (message.type === 'moveMouse') {
          message = { command: 'move', data: { x: message.x, y: message.y } };
        }
        else if (message.type === 'mousePress') {
          message = { command: 'mousedown', data: { x: message.x, y: message.y, button: message.button || 'left' } };
        }
        else if (message.type === 'mouseRelease') {
          message = { command: 'mouseup', data: { x: message.x, y: message.y, button: message.button || 'left' } };
        }
        else if (message.type === 'scroll') {
          // Handle scroll direction by making amount negative for "up"
          let amount = message.amount || 300;
          if (message.direction === 'up') {
            amount = -Math.abs(amount);
          } else {
            amount = Math.abs(amount);
          }
          message = { command: 'scroll', data: { amount } };
        }
        else if (message.type === 'press') {
          if (Array.isArray(message.keys)) {
            message = { command: 'hotkey', data: { keys: message.keys } };
          } else {
            message = { command: 'press', data: { key: message.keys } };
          }
        }
        else if (message.type === 'write') {
          message = { command: 'write', data: { text: message.text } };
        }
        else if (message.type === 'type') {
          // The type command from TestDriver maps to write command in pyautogui
          message = { command: 'write', data: { text: message.text } };
        }
        else if (message.type === 'drag') {
          // Drag is handled as a sequence, but for direct connection we'll map it
          message = { command: 'drag', data: { start: message.start, end: message.end } };
        }
        else if (message.type === 'alert') {
          message = { command: 'alert', data: { text: message.text } };
        }
        else if (message.type === 'keyDown') {
          message = { command: 'keydown', data: { key: message.key } };
        }
        else if (message.type === 'keyUp') {
          message = { command: 'keyup', data: { key: message.key } };
        }
        else if (message.type === 'getScreenSize') {
          // This might need special handling via exec
          message = { command: 'exec', data: { command: 'wmic desktopmonitor get screenheight,screenwidth /format:csv' } };
        }
        else if (message.type === 'output') {
          // Special case for output logging - keep original structure
          // This doesn't map to pyautogui commands
        }
        // Handle authentication and connection commands
        else if (['authenticate', 'create', 'connect', 'list', 'destroy'].includes(message.type)) {
          // These don't need transformation, keep as-is
        }
        else {
          // Default mapping for unhandled commands
          const originalMessage = { ...message };
          delete originalMessage.type; // Remove type to avoid duplication
          message = { command: key || message.type, data: originalMessage };
        }
      }

      message.requestId = `${this.uniqueId}-${this.messageId}`;
      console.log('sending ', message)

      let resolvePromise;
      let rejectPromise;

      if (this.socket) {

        // Start timing for this message using original type
        const timingKey = `sandbox-${originalType}`;
        marky.mark(timingKey);

        let p = new Promise((resolve, reject) => {
          try {
            this.socket.send(JSON.stringify(message));
            emitter.emit(events.sandbox.sent, message);
            resolvePromise = resolve;
            rejectPromise = reject;
          } catch (error) {
            console.error('Error serializing message:', error.message);
            console.error('Problematic message:', message);
            reject(error);
          }
        });

        this.ps[message.requestId] = {
          promise: p,
          resolve: resolvePromise,
          reject: rejectPromise,
          message,
          timingKey,
          startTime: Date.now(),
        };

        return p;
      }
    }

    async auth(apiKey) {
      let reply = await this.send({
        type: "authenticate",
        apiKey,
      });

      if (reply.success) {
        this.authenticated = true;
        emitter.emit(events.sandbox.authenticated);
        return true;
      }
    }

    async connect(sandboxId, persist = false) {
      let reply = await this.send({
        type: "connect",
        persist,
        sandboxId,
      });

      if (reply.success) {
        this.instanceSocketConnected = true;
        emitter.emit(events.sandbox.connected);
      }

      return reply.sandbox;
    }

    async boot(url) {
      return new Promise((resolve, reject) => {

        console.log("Connecting to sandbox at", url);

        this.socket = new WebSocket(url.replace("https://", "wss://"));

        // handle errors
        this.socket.on("close", () => {
          clearInterval(this.heartbeat);
          // Emit a clear error event for API key issues
          reject();
          this.apiSocketConnected = false;
        });

        this.socket.on("error", (err) => {
          console.log("Socket Error");
          err && console.log(err);
          clearInterval(this.heartbeat);
          emitter.emit(events.error.sandbox, err);
          this.apiSocketConnected = false;
          throw err;
        });

        this.socket.on("open", async () => {
          this.apiSocketConnected = true;

          setInterval(() => {
            if (this.socket.readyState === WebSocket.OPEN) {
              this.socket.ping();
            }
          }, 5000);

          resolve(this);
        });

        this.socket.on("message", async (raw) => {
          let message = JSON.parse(raw);

          if (!this.socket?._socket?.remoteAddress.includes(TD_API_ROOT)) {
            // Unfortunately the api transforms the packet, so we need to remap it for direct connection
            message.requestId = message.originalData.requestId;

            const command = message.originalData.command;
            
            // Map responses based on command type
            if (command === 'screenshot') {
              message.base64 = message.result;
              message.type = 'screenshot.reply'; // Match expected API response format
            }
            else if (command === 'exec') {
              message.out = message.result;
            }
            else if (command === 'get-active-window') {
              message.out = message.result;
            }
            else if (command === 'network') {
              message.out = message.result;
            }
            else if (command === 'focus-window') {
              message.out = message.result;
            }
            else if (['click', 'rightclick', 'middleclick', 'doubleclick', 'tripleclick', 'move', 'mousedown', 'mouseup', 'scroll', 'press', 'hotkey', 'write', 'keydown', 'keyup', 'alert'].includes(command)) {
              // These commands typically return success status
              message.success = message.result === true || message.result === 'True';
            }
            else if (message.result !== undefined) {
              // Default mapping for other commands - result is already present
              // No additional transformation needed
            }
          }

          console.log("received", message);

          if (!this.ps[message.requestId]) {
            console.warn(
              "No pending promise found for requestId:",
              message.requestId,
            );
            return;
          }

          if (message.error) {
            emitter.emit(events.error.sandbox, message.errorMessage);
            this.ps[message.requestId].reject(JSON.stringify(message));
          } else {
            emitter.emit(events.sandbox.received);

            // Get timing information for this message
            const pendingMessage = this.ps[message.requestId];
            if (pendingMessage) {
              const timing = marky.stop(pendingMessage.timingKey);

              // Track timing for each message type
              await analytics.track("sandbox", {
                operation: pendingMessage.message.command || pendingMessage.message.type,
                timing,
                requestId: message.requestId,
                timestamp: Date.now(),
                data: {
                  messageType: pendingMessage.message.command || pendingMessage.message.type,
                  command: pendingMessage.message.command,
                },
              });
            }

            console.log('resolving promise')
            this.ps[message.requestId]?.resolve(message);
          }
          delete this.ps[message.requestId];
        });
      });
    }
  }

  return new Sandbox();
};

module.exports = { createSandbox };
