const PubNub = require("pubnub");
const axios = require("axios");
const { events } = require("../events");
const logger = require("./logger");
const { version } = require("../../package.json");

/**
 * PubNub-based sandbox client.
 *
 * Simplified flow:
 *   1. boot(apiRoot) — store API root
 *   2. auth(apiKey) — authenticate via REST
 *   3. connect(sandboxId?) — call /api/v7/sandbox/connect, init PubNub, claim runner
 *   4. send(message) — publish commands to runner via PubNub
 *   5. close() — release runner, disconnect PubNub
 *
 * If sandboxId is omitted in connect(), the API auto-claims
 * the first idle runner from the team's pool via PubNub Presence.
 */
const createSandbox = (emitter, analytics, sessionInstance) => {
  class Sandbox {
    constructor() {
      this.pubnub = null;
      this.ps = {};
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

      // PubNub state
      this._channels = null;
      this._pubnubConfig = null;
      this._sandboxId = null;
      this._sdkToken = null;
      this._runnerReady = false;
      this._runnerReadyPromise = null;
      this._runnerReadyResolve = null;
      this._runnerIp = null;
      this._lastConnectParams = null;

      // Log batching state (≥1s flush interval)
      this._logBuffer = [];
      this._logFlushInterval = null;
    }

    // ─── Lifecycle ─────────────────────────────────────────────────────

    /**
     * Store the API root. Called once at startup.
     */
    async boot(apiRoot) {
      if (apiRoot) this.apiRoot = apiRoot;
      this.apiSocketConnected = true;
      this.reconnectAttempts = 0;
      this.reconnecting = false;
      return this;
    }

    /**
     * Authenticate with the API via REST.
     */
    async auth(apiKey) {
      this.apiKey = apiKey;

      const response = await axios.post(
        `${this.apiRoot}/api/v7/sandbox/authenticate`,
        { apiKey, version },
        { timeout: 30000 },
      );

      if (response.data.success) {
        this.authenticated = true;

        if (response.data.traceId) {
          this.traceId = response.data.traceId;
          logger.log("");
          logger.log("🔗 Trace Report (Share When Reporting Bugs):");
          logger.log(
            `https://testdriver.sentry.io/explore/traces/trace/${response.data.traceId}`,
          );
        }

        emitter.emit(events.sandbox.authenticated, {
          traceId: response.data.traceId,
        });
        return true;
      }

      throw new Error("Authentication failed");
    }

    /**
     * Connect to a runner via the API.
     *
     * If sandboxId is provided, connects to that specific runner.
     * If omitted, the API auto-claims an idle runner from the pool.
     *
     * After connecting, sends a `claim` message to mark the runner busy.
     */
    async connect(sandboxId = null) {
      this._lastConnectParams = { sandboxId };

      const response = await axios.post(
        `${this.apiRoot}/api/v7/sandbox/connect`,
        {
          apiKey: this.apiKey,
          ...(sandboxId ? { sandboxId } : {}),
        },
        { timeout: 30000 },
      );

      const data = response.data;
      if (!data.success) {
        throw new Error(data.message || "Failed to connect to runner");
      }

      this._sandboxId = data.sandboxId;
      this._pubnubConfig = data.pubnub;
      this._channels = data.pubnub.channels;
      this._sdkToken = data.pubnub.token;

      this._initPubNub();

      this.instanceSocketConnected = true;
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
     * Called after connect + waitForRunner.
     */
    async claim() {
      if (!this.pubnub || !this._channels) {
        throw new Error("Not connected");
      }
      return this.send({ type: "claim" }, 15000);
    }

    /**
     * Release the runner (mark it idle in the pool).
     * Called before close() so the runner goes back to the pool.
     */
    async release() {
      if (!this.pubnub || !this._channels) return;
      try {
        await this.send({ type: "release" }, 10000);
      } catch {
        // Best-effort — runner may already be gone
      }
    }

    // ─── send() ────────────────────────────────────────────────────────

    /**
     * Send a command to the runner via PubNub.
     */
    send(message, timeout = 300000) {
      if (!this.pubnub || !this._channels) {
        return Promise.reject(new Error("Sandbox not connected to PubNub"));
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

        // Fire-and-forget types — buffer for log batching instead of publishing individually
        const fireAndForgetTypes = ["output", "trackInteraction"];
        if (fireAndForgetTypes.includes(message.type)) {
          clearTimeout(timeoutId);
          this.pendingTimeouts.delete(requestId);
          delete this.ps[requestId];
          this._bufferLog(message);
          resolve({ success: true });
          return;
        }

        // Publish to commands channel
        this.pubnub
          .publish({ channel: this._channels.commands, message })
          .then(() => emitter.emit(events.sandbox.sent, message))
          .catch((err) => {
            clearTimeout(timeoutId);
            this.pendingTimeouts.delete(requestId);
            delete this.ps[requestId];
            // Log full PubNub Status for debugging
            if (err.status) {
              logger.error(`[PubNub] Publish failed — category: ${err.status.category}, statusCode: ${err.status.statusCode}, operation: ${err.status.operation}`);
              if (err.status.errorData) {
                logger.error(`[PubNub] errorData: ${JSON.stringify(err.status.errorData)}`);
              }
            }
            const publishError = new Error(`Failed to publish command: ${err.message}`);
            publishError.status = err.status;
            reject(publishError);
          });
      });
    }

    // ─── PubNub ────────────────────────────────────────────────────────

    _initPubNub() {
      if (this.pubnub) {
        try {
          this._stopLogBatching();
          this.pubnub.unsubscribeAll();
          this.pubnub.stop();
        } catch {
          // Ignore cleanup errors
        }
      }

      this.pubnub = new PubNub({
        subscribeKey: this._pubnubConfig.subscribeKey,
        publishKey: this._pubnubConfig.publishKey,
        userId: `sdk-${this._sandboxId}`,
      });

      this.pubnub.setToken(this._sdkToken);

      // Runner ready promise
      this._runnerReady = false;
      this._runnerReadyPromise = new Promise((resolve) => {
        this._runnerReadyResolve = resolve;
      });

      // Attach listener BEFORE subscribing
      this.pubnub.addListener({
        message: (event) => this._handleMessage(event),
        file: (event) => this._handleFileMessage(event),
        status: (event) => this._handleStatus(event),
      });

      this.pubnub.subscribe({
        channels: [
          this._channels.responses,
          this._channels.files,
          this._channels.control,
        ].filter(Boolean),
      });

      // Start log batching interval
      this._startLogBatching();

      this.apiSocketConnected = true;
      logger.log(
        `[Sandbox] PubNub connected. Channels: ${JSON.stringify(this._channels)}`,
      );
    }

    _handleMessage(event) {
      const message = event.message;

      // ─── Control channel messages from server ──────────────────────
      if (this._channels.control && event.channel === this._channels.control) {
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
        logger.log(`[Sandbox] Control message: ${message.type}`);
        return;
      }

      // Runner ready / pong
      if (message.type === "runner.ready" || message.type === "pong") {
        this._runnerReady = true;
        if (message.ip) this._runnerIp = message.ip;
        if (this._runnerReadyResolve) {
          this._runnerReadyResolve();
          this._runnerReadyResolve = null;
        }
        logger.log("[Sandbox] Runner is ready");
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

      // Screenshot with file reference
      if (
        message.type === "screenshot.reply" &&
        message.fileId &&
        message.fileName
      ) {
        this._downloadScreenshot(requestId, message);
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

    _handleFileMessage(event) {
      const msg = event.message;
      if (!msg || !msg.requestId || !this.ps[msg.requestId]) return;

      // Only process explicit screenshot files — ignore auto before/after screenshots
      // Auto-screenshots have type 'before.file' or 'after.file' and are fire-and-forget
      if (msg.type && msg.type !== "screenshot.file") return;

      this._downloadScreenshot(msg.requestId, {
        fileId: event.file.id,
        fileName: event.file.name,
      });
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
      if (!this.pubnub || !this._channels) return;
      const entries = this._logBuffer.splice(0, this._logBuffer.length);
      this.pubnub
        .publish({
          channel: this._channels.commands,
          message: { type: "logs.batch", entries },
        })
        .then(() => emitter.emit(events.sandbox.sent, { type: "logs.batch", count: entries.length }))
        .catch((err) => {
          logger.error(`[Sandbox] Failed to flush ${entries.length} log entries: ${err.message}`);
        });
    }

    async _downloadScreenshot(requestId, fileInfo) {
      const pending = this.ps[requestId];
      if (!pending) return;

      try {
        const result = await this.pubnub.downloadFile({
          channel: this._channels.files,
          id: fileInfo.fileId,
          name: fileInfo.fileName,
        });

        let buffer;
        if (result.data instanceof Buffer) {
          buffer = result.data;
        } else if (result.data instanceof ArrayBuffer) {
          buffer = Buffer.from(result.data);
        } else if (typeof result.data.arrayBuffer === "function") {
          buffer = Buffer.from(await result.data.arrayBuffer());
        } else if (typeof result.data.toArrayBuffer === "function") {
          buffer = Buffer.from(await result.data.toArrayBuffer());
        } else if (typeof result.data.toBuffer === "function") {
          buffer = await result.data.toBuffer();
        } else {
          buffer = Buffer.from(result.data);
        }

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

    _handleStatus(event) {
      switch (event.category) {
        case "PNConnectedCategory":
          logger.log("[Sandbox] PubNub subscription connected");
          break;
        case "PNReconnectedCategory":
          logger.log("[Sandbox] PubNub reconnected");
          this.reconnecting = false;
          break;
        case "PNAccessDeniedCategory":
          logger.log(
            "[Sandbox] PubNub access denied — token expired or revoked",
          );
          emitter.emit(
            events.error.sandbox,
            "Session ended — access token revoked by server",
          );
          // Token revoked = session terminated by the server ("kicked")
          this.close();
          break;
        case "PNNetworkDownCategory":
          logger.log("[Sandbox] Network down");
          this._handleConnectionLoss();
          break;
        default:
          break;
      }
    }

    // ─── Runner readiness ──────────────────────────────────────────────

    async waitForRunner(timeout = 60000) {
      if (this._runnerReady) return;
      if (!this.pubnub || !this._channels) {
        throw new Error("Not connected to PubNub");
      }

      await new Promise((resolve, reject) => {
        const deadline = setTimeout(() => {
          clearInterval(pollInterval);
          reject(new Error("Runner did not become ready within timeout"));
        }, timeout);

        const pollInterval = setInterval(() => {
          if (this._runnerReady) {
            clearTimeout(deadline);
            clearInterval(pollInterval);
            return resolve();
          }
          this.pubnub
            .publish({
              channel: this._channels.commands,
              message: { type: "ping", requestId: `ping-${Date.now()}` },
            })
            .catch(() => {});
        }, 2000);

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
          if (this.apiKey && this._lastConnectParams) {
            await this.auth(this.apiKey);
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
     * Release the runner and close PubNub.
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

      if (this.pubnub) {
        try {
          this.pubnub.unsubscribeAll();
          this.pubnub.stop();
        } catch {
          // Ignore
        }
        this.pubnub = null;
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
