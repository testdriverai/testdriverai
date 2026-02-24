const WebSocket = require("ws");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { eventsArray } = require("../events.js");
const logger = require("./logger");

let server = null;
let wss = null;
let clients = new Set();
let refCount = 0; // Number of active consumers (for concurrent test safety)
let debuggerUrl = null; // Stored URL of running debugger

function createDebuggerServer(config = {}) {
  const port = config.TD_DEBUGGER_PORT || 0; // 0 means find available port

  return new Promise((resolve, reject) => {
    // Create HTTP server
    server = http.createServer((req, res) => {
      const url = req.url;

      // Parse URL to get pathname without query parameters
      const urlObj = new URL(url, `http://${req.headers.host}`);
      const pathname = urlObj.pathname;

      // Serve static files from debugger directory
      let filePath;
      if (pathname === "/" || pathname === "/index.html") {
        filePath = path.join(__dirname, "..", "..", "debugger", "index.html");
      } else {
        // Remove leading slash and serve from debugger directory
        const cleanUrl = pathname.startsWith("/")
          ? pathname.substring(1)
          : pathname;
        filePath = path.join(__dirname, "..", "..", "debugger", cleanUrl);
      }

      // Check if file exists
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath);
        const contentType =
          {
            ".html": "text/html",
            ".css": "text/css",
            ".js": "application/javascript",
            ".json": "application/json",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".svg": "image/svg+xml",
            ".ico": "image/x-icon",
          }[ext] || "application/octet-stream";

        res.writeHead(200, { "Content-Type": contentType });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    // Create WebSocket server
    wss = new WebSocket.Server({ server });

    wss.on("connection", (ws) => {
      clients.add(ws);

      ws.on("close", () => {
        clients.delete(ws);
      });

      ws.on("error", (error) => {
        console.error("WebSocket client error:", error);
        clients.delete(ws);
      });
    });

    // Start server on available port
    server.listen(port, "localhost", () => {
      const address = server.address();
      if (!address) {
        reject(new Error("Server started but address is not available"));
        return;
      }
      const actualPort = address.port;
      resolve({ port: actualPort, server, wss });
    });

    server.on("error", (error) => {
      console.error("Server error:", error);
      reject(error);
    });
  });
}

function broadcastEvent(event, data) {
  if (clients.size === 0) {
    return;
  }

  const message = JSON.stringify({ event, data });

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

async function startDebugger(config = {}, emitter) {
  try {
    const { port } = await createDebuggerServer(config);
    const url = `http://localhost:${port}`;

    // Set up event listeners for all events
    for (const event of eventsArray) {
      emitter.on(event, async (data) => {
        broadcastEvent(event, data);
      });
    }

    // Store the debugger URL and config for later use
    module.exports.debuggerUrl = url;
    module.exports.config = config;

    return { port, url };
  } catch (error) {
    console.error("Failed to start debugger server:", error);
    throw error;
  }
}

/**
 * Acquire a reference to the debugger server.
 * Starts the server on first call; subsequent calls reuse the existing server.
 * Each call increments a reference count — call releaseDebugger() when done.
 *
 * @param {Object} config - Debugger configuration
 * @param {EventEmitter} emitter - Event emitter for broadcasting
 * @returns {Promise<{port: number, url: string}>} Debugger connection info
 */
async function acquireDebugger(config = {}, emitter) {
  refCount++;
  if (server && debuggerUrl) {
    // Server already running — reuse it
    return { url: debuggerUrl };
  }
  // First consumer — start the server
  const result = await startDebugger(config, emitter);
  debuggerUrl = result.url;
  return result;
}

/**
 * Release a reference to the debugger server.
 * Only actually stops the server when the last consumer releases.
 */
function releaseDebugger() {
  if (refCount > 0) refCount--;
  if (refCount > 0) return; // Other tests still using it
  forceStopDebugger();
}

/**
 * Forcefully stop the debugger server regardless of reference count.
 * Used for process exit cleanup.
 */
function forceStopDebugger() {
  refCount = 0;
  if (wss) {
    wss.close();
    wss = null;
  }

  if (server) {
    server.close();
    server = null;
  }

  clients.clear();
  debuggerUrl = null;
  module.exports.debuggerUrl = null;
  module.exports.config = null;
  logger.log("Debugger server stopped");
}

// Keep stopDebugger as alias for forceStopDebugger for backward compatibility
function stopDebugger() {
  forceStopDebugger();
}

module.exports = {
  startDebugger,
  stopDebugger,
  acquireDebugger,
  releaseDebugger,
  forceStopDebugger,
  broadcastEvent,
  createDebuggerServer,
  debuggerUrl: null,
  config: null,
};
