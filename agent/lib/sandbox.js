const WebSocket = require("ws");
const crypto = require("crypto");
const https = require("https");
const http = require("http");
const { events } = require("../events");
const logger = require("./logger");
const { version } = require("../../package.json");

/**
 * WebSocket-based sandbox client for self-hosted runners.
 *
 * Flow:
 *   1. boot(apiRoot) — open WebSocket to API sandboxes service
 *   2. auth(apiKey) — authenticate via WS message
 *   3. connect(sandboxId?) — send create message (runner: true), API sets up SQS proxy
 *   4. waitForRunner() — ping until runner responds via SQS → API → WS
 *   5. claim() — mark runner busy (forwarded to runner via SQS)
 *   6. send(message) — publish commands via WS → API → SQS → runner
 *   7. close() — release runner, close WS
 *
 * Commands flow: SDK → WS → API → SQS → Runner
 * Responses flow: Runner → SQS → API → WS → SDK
 * Screenshots: Runner uploads to S3, API returns presigned download URL
 */

function getSentryTraceHeaders(sessionId) {
  if (!sessionId) return {};
  const traceId = crypto.createHash("md5").update(sessionId).digest("hex");
  const spanId = crypto.randomBytes(8).toString("hex");
  return {
    "sentry-trace": `${traceId}-${spanId}-1`,
    baggage: `sentry-trace_id=${traceId},sentry-sample_rate=1.0,sentry-sampled=true`,
  };
}

const createSandbox = (emitter, analytics, sessionInstance) => {
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
      this.os = null;
      this.sessionInstance = sessionInstance;
      this.traceId = null;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 10;
      this.intentionalDisconnect = false;
      this.apiRoot = null;
      this.apiKey = null;
      this.reconnectTimer = null;
      this.reconnecting = false;
      this.pendingTimeouts = new Map();
      this.pendingRetryQueue = [];

      // Runner state
      this._sandboxId = null;
      this._runnerReady = false;
      this._runnerReadyResolve = null;
      this._runnerIp = null;
      this._lastConnectParams = null;

      // Log batching state (≥1s flush interval)
      this._logBuffer = [];
      this._logFlushInterval = null;
    }

    // ─── Lifecycle ─────────────────────────────────────────────────────

    /**
     * Open WebSocket connection to the API sandboxes service.
     * Called once at startup.
     */
    async boot(apiRoot) {
      if (apiRoot) this.apiRoot = apiRoot;

      return new Promise((resolve, reject) => {
        const sessionId = this.sessionInstance?.get();
        const sentryHeaders = getSentryTraceHeaders(sessionId);

        // Build WebSocket URL with Sentry trace headers as query params
        const wsUrl = new URL(apiRoot.replace("https://", "wss://").replace("http://", "ws://"));
        if (sentryHeaders["sentry-trace"]) {
          wsUrl.searchParams.set("sentry-trace", sentryHeaders["sentry-trace"]);
        }
        if (sentryHeaders["baggage"]) {
          wsUrl.searchParams.set("baggage", sentryHeaders["baggage"]);
        }

        this.socket = new WebSocket(wsUrl.toString());

        this.socket.on("close", () => {
          clearInterval(this.heartbeat);
          this.apiSocketConnected = false;
          this._handleConnectionLoss();
        });

        this.socket.on("error", (err) => {
          logger.log("Socket Error");
          if (err) logger.log(err);
          clearInterval(this.heartbeat);
          emitter.emit(events.error.sandbox, err);
          this.apiSocketConnected = false;
        });

        this.socket.on("open", () => {
          this.reconnectAttempts = 0;
          this.reconnecting = false;
          this.apiSocketConnected = true;

          // WS keepalive ping
          this.heartbeat = setInterval(() => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
              this.socket.ping();
            }
          }, 5000);

          resolve(this);
        });

        this.socket.on("message", (raw) => {
          this._handleMessage(JSON.parse(raw));
        });
      });
    }

    /**
     * Authenticate with the API via WebSocket.
     */
    async auth(apiKey) {
      this.apiKey = apiKey;

      const reply = await this.send({
        type: "authenticate",
        apiKey,
        version,
      });

      if (reply.success) {
        this.authenticated = true;

        if (reply.traceId) {
          this.traceId = reply.traceId;
          logger.log("");
          logger.log("🔗 Trace Report (Share When Reporting Bugs):");
          logger.log(
            `https://testdriver.sentry.io/explore/traces/trace/${reply.traceId}`,
          );
        }

        emitter.emit(events.sandbox.authenticated, {
          traceId: reply.traceId,
        });
        return true;
      }

      throw new Error("Authentication failed");
    }

    /**
     * Connect to a self-hosted runner via the API's SQS proxy.
     *
     * Sends a create message with runner: true. The API finds an idle runner
     * from the pool, sets up an SQS command proxy, and returns the sandboxId.
     *
     * If sandboxId is provided, connects to that specific runner.
     * If omitted, the API auto-claims an idle runner from the pool.
     */
    async connect(sandboxId = null) {
      this._lastConnectParams = { sandboxId };

      const reply = await this.send(
        {
          type: "create",
          runner: true,
          ...(sandboxId ? { sandboxId } : {}),
        },
        60000,
      );

      const replySandboxId = reply.sandbox?.sandboxId || reply.sandboxId;

      if (!reply.success && !replySandboxId) {
        throw new Error(reply.errorMessage || "Failed to connect to runner");
      }

      this._sandboxId = replySandboxId || sandboxId;
      this.instanceSocketConnected = true;

      // Start log batching
      this._startLogBatching();

      emitter.emit(events.sandbox.connected);

      return {
        success: true,
        sandboxId: this._sandboxId,
        sandbox: {
          sandboxId: this._sandboxId,
          os: this.os || "linux",
        },
      };
    }

    /**
     * Claim the runner (mark it busy in the pool).
     * Forwarded via SQS proxy to the runner.
     */
    async claim() {
      if (!this.socket || !this._sandboxId) {
        throw new Error("Not connected");
      }
      return this.send({ type: "claim" }, 15000);
    }

    /**
     * Release the runner (mark it idle in the pool).
     * Called before close() so the runner goes back to the pool.
     */
    async release() {
      if (!this.socket || !this._sandboxId) return;
      try {
        await this.send({ type: "release" }, 10000);
      } catch {
        // Best-effort — runner may already be gone
      }
    }

    // ─── send() ────────────────────────────────────────────────────────

    /**
     * Send a command to the runner via WebSocket → API → SQS.
     */
    send(message, timeout = 300000) {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return Promise.reject(new Error("Sandbox WebSocket not connected"));
      }

      this.messageId++;
      message.requestId = `${this.uniqueId}-${this.messageId}`;

      if (message.os) this.os = message.os;
      if (this.os && !message.os) message.os = this.os;

      if (this.sessionInstance && !message.session) {
        const sessionId = this.sessionInstance.get();
        if (sessionId) message.session = sessionId;
      }

      if (this._sandboxId && !message.sandboxId) {
        message.sandboxId = this._sandboxId;
      }

      const requestId = message.requestId;

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          this.pendingTimeouts.delete(requestId);
          if (this.ps[requestId]) {
            delete this.ps[requestId];
            reject(
              new Error(
                `Sandbox message '${message.type}' timed out after ${timeout}ms`,
              ),
            );
          }
        }, timeout);

        this.pendingTimeouts.set(requestId, timeoutId);

        this.ps[requestId] = {
          resolve: (result) => {
            clearTimeout(timeoutId);
            this.pendingTimeouts.delete(requestId);
            resolve(result);
          },
          reject: (error) => {
            clearTimeout(timeoutId);
            this.pendingTimeouts.delete(requestId);
            reject(error);
          },
          message,
          startTime: Date.now(),
        };

        // Fire-and-forget types — buffer for log batching instead of sending individually
        const fireAndForgetTypes = ["output", "trackInteraction"];
        if (fireAndForgetTypes.includes(message.type)) {
          clearTimeout(timeoutId);
          this.pendingTimeouts.delete(requestId);
          delete this.ps[requestId];
          this._bufferLog(message);
          resolve({ success: true });
          return;
        }

        // Send via WebSocket
        try {
          this.socket.send(JSON.stringify(message));
          emitter.emit(events.sandbox.sent, message);
        } catch (err) {
          clearTimeout(timeoutId);
          this.pendingTimeouts.delete(requestId);
          delete this.ps[requestId];
          reject(new Error(`Failed to send command: ${err.message}`));
        }
      });
    }

    // ─── Message handling ──────────────────────────────────────────────

    _handleMessage(message) {
      // ─── Control messages from server ──────────────────────────────
      if (message.type === "session.terminated") {
        logger.log(
          `[Sandbox] Session terminated by server: ${message.reason} — ${message.message}`,
        );
        emitter.emit(events.error.sandbox, message.message || "Session terminated by server");
        this.close();
        return;
      }

      if (message.type === "session.warning") {
        logger.log(
          `[Sandbox] Server warning: ${message.message} (usage: ${message.usagePercentage}%)`,
        );
        emitter.emit(events.sandbox.progress, {
          step: "warning",
          message: message.message,
        });
        return;
      }

      // Runner ready / pong — resolve waitForRunner
      if (message.type === "runner.ready" || message.type === "pong") {
        this._runnerReady = true;
        if (message.ip) this._runnerIp = message.ip;
        if (this._runnerReadyResolve) {
          this._runnerReadyResolve();
          this._runnerReadyResolve = null;
        }
        logger.log("[Sandbox] Runner is ready");

        // Also resolve pending ping request if it has a requestId
        if (message.requestId && this.ps[message.requestId]) {
          this.ps[message.requestId].resolve(message);
          delete this.ps[message.requestId];
        }
        return;
      }

      // Progress messages (no requestId)
      if (message.type === "sandbox.progress") {
        emitter.emit(events.sandbox.progress, {
          step: message.step,
          message: message.message,
        });
        return;
      }

      // Batched log entries from runner — emit each individually
      if (message.type === "logs.batch" && Array.isArray(message.entries)) {
        for (const entry of message.entries) {
          const payload = entry.payload || entry;
          emitter.emit(events.sandbox.received, payload);
        }
        return;
      }

      const requestId = message.requestId;
      if (!requestId || !this.ps[requestId]) return;

      // Screenshot with S3 download URL — download and convert to base64
      if (
        message.type === "screenshot.reply" &&
        message.downloadUrl &&
        !message.base64
      ) {
        this._downloadScreenshotFromUrl(requestId, message.downloadUrl);
        return;
      }

      // Error response
      if (message.error) {
        const pendingMessage = this.ps[requestId]?.message;
        if (pendingMessage?.type !== "output") {
          emitter.emit(events.error.sandbox, message.errorMessage);
        }
        const error = new Error(message.errorMessage || "Sandbox error");
        error.responseData = message;
        this.ps[requestId].reject(error);
      } else {
        emitter.emit(events.sandbox.received);
        this.ps[requestId].resolve(message);
      }
      delete this.ps[requestId];
    }

    // ─── Screenshot download via S3 presigned URL ──────────────────

    async _downloadScreenshotFromUrl(requestId, downloadUrl) {
      const pending = this.ps[requestId];
      if (!pending) return;

      try {
        const buffer = await new Promise((resolve, reject) => {
          const client = downloadUrl.startsWith("https") ? https : http;
          client
            .get(downloadUrl, (res) => {
              if (res.statusCode !== 200) {
                reject(new Error(`Screenshot download failed: HTTP ${res.statusCode}`));
                return;
              }
              const chunks = [];
              res.on("data", (chunk) => chunks.push(chunk));
              res.on("end", () => resolve(Buffer.concat(chunks)));
              res.on("error", reject);
            })
            .on("error", reject);
        });

        pending.resolve({
          type: "screenshot.reply",
          requestId,
          base64: buffer.toString("base64"),
          success: true,
        });
      } catch (err) {
        pending.reject(
          new Error(`Failed to download screenshot: ${err.message}`),
        );
      }
      delete this.ps[requestId];
    }

    // ─── Log batching (≥1s flush) ──────────────────────────────────────

    _bufferLog(message) {
      this._logBuffer.push({
        type: message.type,
        payload: message,
        timestamp: Date.now(),
      });
    }

    _startLogBatching() {
      this._stopLogBatching();
      this._logFlushInterval = setInterval(() => {
        this._flushLogs();
      }, 1000);
    }

    _stopLogBatching() {
      if (this._logFlushInterval) {
        clearInterval(this._logFlushInterval);
        this._logFlushInterval = null;
      }
      // Final flush
      this._flushLogs();
    }

    _flushLogs() {
      if (this._logBuffer.length === 0) return;
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
      const entries = this._logBuffer.splice(0, this._logBuffer.length);
      try {
        this.socket.send(
          JSON.stringify({ type: "logs.batch", entries }),
        );
        emitter.emit(events.sandbox.sent, { type: "logs.batch", count: entries.length });
      } catch (err) {
        logger.error(`[Sandbox] Failed to flush ${entries.length} log entries: ${err.message}`);
      }
    }

    // ─── Runner readiness ──────────────────────────────────────────────

    async waitForRunner(timeout = 60000) {
      if (this._runnerReady) return;
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        throw new Error("Not connected to WebSocket");
      }

      await new Promise((resolve, reject) => {
        const deadline = setTimeout(() => {
          clearInterval(pollInterval);
          reject(new Error("Runner did not become ready within timeout"));
        }, timeout);

        // Store the resolve for _handleMessage to call
        this._runnerReadyResolve = () => {
          clearTimeout(deadline);
          clearInterval(pollInterval);
          resolve();
        };

        const pollInterval = setInterval(() => {
          if (this._runnerReady) {
            clearTimeout(deadline);
            clearInterval(pollInterval);
            if (this._runnerReadyResolve) {
              this._runnerReadyResolve();
              this._runnerReadyResolve = null;
            }
            return;
          }
          // Send ping, forwarded to runner via SQS proxy
          try {
            this.socket.send(
              JSON.stringify({ type: "ping", requestId: `ping-${Date.now()}` }),
            );
          } catch {
            // ignore
          }
        }, 2000);

        // Quick check loop
        const check = () => {
          if (this._runnerReady) {
            clearTimeout(deadline);
            clearInterval(pollInterval);
            resolve();
          } else {
            setTimeout(check, 500);
          }
        };
        check();
      });
    }

    // ─── Reconnection ──────────────────────────────────────────────────

    async _handleConnectionLoss() {
      if (this.intentionalDisconnect) return;
      if (this.reconnecting) return;
      this.reconnecting = true;

      // Queue pending requests for retry
      const pendingRequestIds = Object.keys(this.ps);
      if (pendingRequestIds.length > 0) {
        for (const requestId of pendingRequestIds) {
          const pending = this.ps[requestId];
          if (pending) {
            const timeoutId = this.pendingTimeouts.get(requestId);
            if (timeoutId) {
              clearTimeout(timeoutId);
              this.pendingTimeouts.delete(requestId);
            }
            this.pendingRetryQueue.push({
              message: pending.message,
              resolve: pending.resolve,
              reject: pending.reject,
            });
          }
        }
        this.ps = {};
      }

      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        emitter.emit(
          events.error.sandbox,
          "Unable to reconnect to TestDriver sandbox after multiple attempts.",
        );

        for (const queued of this.pendingRetryQueue) {
          queued.reject(new Error("Sandbox reconnection failed"));
        }
        this.pendingRetryQueue = [];
        this.reconnecting = false;
        return;
      }

      this.reconnectAttempts++;
      const delay = Math.min(1000 * 2 ** (this.reconnectAttempts - 1), 60000);

      console.log(
        `[Sandbox] Reconnecting in ${delay}ms... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
      );

      this.reconnectTimer = setTimeout(async () => {
        this.reconnectTimer = null;
        try {
          await this.boot(this.apiRoot);
          if (this.apiKey) {
            await this.auth(this.apiKey);
          }
          if (this._lastConnectParams) {
            await this.connect(this._lastConnectParams.sandboxId);
          }
          console.log("[Sandbox] Reconnected successfully.");
          await this._retryQueuedRequests();
        } catch {
          // Will retry on next cycle
        } finally {
          this.reconnecting = false;
        }
      }, delay);
    }

    async _retryQueuedRequests() {
      if (this.pendingRetryQueue.length === 0) return;

      const toRetry = this.pendingRetryQueue.splice(0);
      for (const queued of toRetry) {
        try {
          const result = await this.send(queued.message);
          queued.resolve(result);
        } catch (err) {
          queued.reject(err);
        }
      }
    }

    // ─── Getters ───────────────────────────────────────────────────────

    getTraceId() {
      return this.traceId;
    }

    getTraceUrl() {
      if (!this.traceId) return null;
      return `https://testdriver.sentry.io/explore/traces/trace/${this.traceId}`;
    }

    // ─── close() ───────────────────────────────────────────────────────

    /**
     * Release the runner and close WebSocket.
     */
    async close() {
      this.intentionalDisconnect = true;
      this.reconnecting = false;

      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      for (const timeoutId of this.pendingTimeouts.values()) {
        clearTimeout(timeoutId);
      }
      this.pendingTimeouts.clear();

      // Flush and stop log batching
      this._stopLogBatching();

      // Release the runner back to the pool
      await this.release();

      if (this.heartbeat) {
        clearInterval(this.heartbeat);
        this.heartbeat = null;
      }

      if (this.socket) {
        try {
          this.socket.close();
        } catch {
          // Ignore
        }
        this.socket = null;
      }

      this.apiSocketConnected = false;
      this.instanceSocketConnected = false;
      this.authenticated = false;
      this.instance = null;
      this.ps = {};
      this.pendingRetryQueue = [];
    }
  }

  return new Sandbox();
};

module.exports = { createSandbox };
