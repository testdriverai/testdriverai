const { WindowsSpawner } = require("./windows-spawner");
const marky = require("marky");
const { events } = require("../events");

const createSandbox = (emitter, analytics, ip = null) => {
  class Sandbox {
    constructor() {
      this.spawner = null;
      this.ps = {};
      this.messageId = 0;
      this.uniqueId = Math.random().toString(36).substring(7);
      this.authenticated = false;
      this.instance = null;
      this.instanceIp = ip;
    }

    send(message) {
      let resolvePromise;
      let rejectPromise;

      // For connection-related messages, we don't need an existing client
      const connectionMessages = ["authenticate", "connect", "create"];
      
      if (this.spawner && (connectionMessages.includes(message.type) || this.spawner.getClient())) {
        this.messageId++;
        message.requestId = `${this.uniqueId}-${this.messageId}`;

        // Start timing for this message
        const timingKey = `sandbox-${message.type}`;
        marky.mark(timingKey);

        let p = new Promise((resolve, reject) => {
          resolvePromise = resolve;
          rejectPromise = reject;
          
          // Handle different message types
          this.handleMessage(message)
            .then(result => {
              emitter.emit(events.sandbox.sent, message);
              resolve(result);
            })
            .catch(err => {
              reject(err);
            });
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
      } else {
        return Promise.reject(new Error("Sandbox not initialized or client not connected"));
      }
    }

    async handleMessage(message) {
      // For connection messages, we don't need the client yet
      if (message.type === "authenticate") {
        // For direct connection, we don't need API authentication
        this.authenticated = true;
        emitter.emit(events.sandbox.authenticated);
        return { success: true };
      }
      
      if (message.type === "connect") {
        // Connect to TestDriver instance by IP
        await this.spawner.connectToInstance(message.apiKey || process.env.TD_API_KEY, this.instanceIp);
        emitter.emit(events.sandbox.connected);
        return { success: true, sandbox: this.spawner.toJSON() };
      }
      
      if (message.type === "create") {
        // For CLI, we always connect to existing instance by IP
        await this.spawner.connectToInstance(process.env.TD_API_KEY, this.instanceIp);
        return { 
          success: true, 
          sandbox: this.spawner.toJSON()
        };
      }
      
      // For all other messages, we need the client
      const client = this.spawner.getClient();
      if (!client) {
        throw new Error("PyAutoGUI client is not connected");
      }
      
      switch (message.type) {
        case "leftClick":
          await client.click(message.x, message.y, 'left');
          return { type: 'reply' };
          
        case "rightClick":
          await client.rightClick(message.x, message.y);
          return { type: 'reply' };
          
        case "doubleClick":
          await client.doubleClick(message.x, message.y);
          return { type: 'reply' };
          
        case "write":
          await client.write(message.text);
          return { type: 'reply' };
          
        case "press":
          if (Array.isArray(message.keys)) {
            await client.hotkey(...message.keys);
          } else {
            await client.press(message.keys);
          }
          return { type: 'reply' };
          
        case "system.screenshot": {
          const screenshot = await client.screenshot();
          return {
            type: 'screenshot.reply',
            base64: screenshot
          };
        }
          
        case "moveTo":
          await client.moveTo(message.x, message.y);
          return { type: 'reply' };
          
        case "scroll":
          await client.scroll(message.amount);
          return { type: 'reply' };
          
        case "drag":
          // Simulate drag with moveTo and click sequence
          await client.moveTo(message.start.x, message.start.y);
          await client.click(message.start.x, message.start.y, 'left');
          await client.moveTo(message.end.x, message.end.y);
          return { type: 'reply' };
          
        case "mousePress":
          await client.mouseDown(message.x, message.y, message.button);
          return { type: 'reply' };
          
        case "mouseRelease":
          await client.mouseUp(message.x, message.y, message.button);
          return { type: 'reply' };
          
        case "exec": {
          const result = await client.exec(message.command);
          return {
            type: 'reply',
            success: true,
            out: result
          };
        }
        
        case "output": {
          // Handle output logging to the instance
          if (!message.output || !message.output.length) {
            return { type: 'reply' };
          }

          let outputString = typeof message.output === 'string' 
            ? message.output 
            : JSON.stringify(message.output);

          // Decode base64 output and write to testdriver.log preserving ANSI characters
          const command = `$bytes = [System.Convert]::FromBase64String('${outputString}');
Add-Content -Path "C:\\Users\\testdriver\\Documents\\testdriver.log" -Value ([System.Text.Encoding]::ASCII.GetString($bytes))`;
          
          const out = await client.exec(command);
          return {
            type: 'reply',
            success: true,
            out: out
          };
        }
        
        case "system.get-mouse-position": {
          const out = await client.exec(
            `Add-Type -AssemblyName System.Windows.Forms; $p=[System.Windows.Forms.Cursor]::Position; Write-Output ("{""x"":$($p.X),""y"":$($p.Y)}")`
          );

          let result = { x: 0, y: 0 };
          
          if (out.stdout) {
            try {
              result = JSON.parse(out.stdout);
            } catch (e) {
              console.warn('Failed to parse mouse position:', out.stdout);
            }
          }

          return {
            type: 'system.get-mouse-position.reply',
            out: result
          };
        }
        
        case "system.get-active-window": {
          const out = await client.exec(`C:\\testdriver\\pyautogui-cli\\getActiveWindow.ps1`);
          
          let result = out.stdout || '';
          
          try {
            const parsed = JSON.parse(out.stdout);
            result = `${parsed.owner?.name} - ${parsed.title}`;
          } catch (e) {
            // If parsing fails, use the raw output
            result = out.stdout || '';
          }

          return {
            type: 'system.get-active-window.reply',
            out: result
          };
        }
        
        case "getScreenSize": {
          const out = await client.exec('wmic desktopmonitor get screenheight,screenwidth /format:csv');
          return {
            type: 'getScreenSize',
            out: out
          };
        }
        
        case "commands.run": {
          const timeout_ms = message.timeout || 30 * 1000;
          const timeout_s = timeout_ms / 1000;
          const out = await client.exec(message.command, timeout_s);
          return {
            type: 'commands.run.reply',
            out: out
          };
        }
        
        case "commands.focus-application": {
          const out = await client.exec(
            `powershell -ExecutionPolicy Bypass -Command "& { C:\\testdriver\\pyautogui-cli\\focusWindow.ps1 '${message.name}' 'Focus' }"`
          );
          return {
            type: 'commands.focus-application',
            out: out
          };
        }
        
        case "system.network": {
          const out = await client.exec(
            `powershell -ExecutionPolicy Bypass -Command "& { C:\\testdriver\\pyautogui-cli\\network.ps1 '${message.name}' 'Focus' }"`
          );

          let result = out;
          try {
            result = JSON.parse(out.stdout);
          } catch (e) {
            console.warn('Error parsing network output:', e);
            result = out.stdout || out.stderr || 'Unknown error';
          }

          return {
            type: 'system.network',
            out: result
          };
        }
        
        case "middleClick":
          await client.middleClick(message.x, message.y);
          return { type: 'reply' };
          
        case "moveMouse":
          await client.moveTo(message.x, message.y);
          return { type: 'reply' };
          
        case "list":
          // For CLI, we don't maintain a list of instances - just return empty
          return {
            type: 'list.reply',
            success: true,
            sandboxes: []
          };
          
        case "destroy":
          // For CLI, we don't handle instance destruction - instances are managed externally
          return {
            type: 'destroy.reply',
            success: true
          };
          
        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }
    }

    async auth() {
      // For direct connection, we always return true since we don't need API auth
      this.authenticated = true;
      emitter.emit(events.sandbox.authenticated);
      return true;
    }

    async connect(sandboxId, persist = false) {
      const message = {
        type: "connect",
        persist,
        sandboxId,
        apiKey: process.env.TD_API_KEY
      };
      
      const reply = await this.send(message);
      
      if (reply.success) {
        emitter.emit(events.sandbox.connected);
      }

      return reply.sandbox;
    }

    async boot() {
      return new Promise((resolve) => {
        // Initialize the Windows spawner with IP
        this.spawner = new WindowsSpawner(this.instanceIp);
        
        emitter.emit(events.sandbox.connected);
        resolve(this);
      });
    }
  }

  return new Sandbox();
};

module.exports = { createSandbox };
