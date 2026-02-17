const PubNub = require("pubnub");
const crypto = require("crypto");
const axios = require("axios");
const { events } = require("../events");
const logger = require("./logger");
const { version } = require("../../package.json");

/**
 * PubNub-based sandbox client.
 *
 * Replaces the WebSocket-based sandbox with direct SDK ↔ Runner
 * communication via PubNub pub/sub. The API is only called for
 * lifecycle operations (auth, create, destroy) via REST.
 *
 * Same public interface as the original:
 *   boot(apiRoot) → auth(apiKey) → connect(sandboxId) → send(message) → close()
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

      // PubNub-specific state
      this._channels = null;
      this._pubnubConfig = null;
      this._sandboxId = null;
      this._sdkToken = null;
      this._runnerToken = null;
      this._runnerReady = false;
      this._runnerReadyPromise = null;
      this._runnerReadyResolve = null;
      this._lastConnectParams = null;
      this._fileListeners = {};
    }

    getTraceId() {
      return this.traceId;
    }

    getTraceUrl() {
      if (!this.traceId) return null;
      return `https://testdriver.sentry.io/explore/traces/trace/${this.traceId}`;
    }

    /**
     * Send a command to the runner via PubNub
     * Same interface as the original WebSocket-based send()
     */
    send(message, timeout = 300000) {
      if (!this.pubnub || !this._channels) {
        return Promise.reject(new Error("Sandbox not connected to PubNub"));
      }

      this.messageId++;
      message.requestId = `${this.uniqueId}-${this.messageId}`;

      // Attach OS to every message
      if (message.os) {
        this.os = message.os;
      }
      if (this.os && !message.os) {
        message.os = this.os;
      }

      // Attach session
      if (this.sessionInstance && !message.session) {
        const sessionId = this.sessionInstance.get();
        if (sessionId) {
          message.session = sessionId;
        }
      }

      // Attach sandboxId
      if (this._sandboxId && !message.sandboxId) {
        message.sandboxId = this._sandboxId;
      }

      const requestId = message.requestId;

      return new Promise((resolve, reject) => {
        // Set up timeout
        const timeoutId = setTimeout(() => {
          this.pendingTimeouts.delete(requestId);
          if (this.ps[requestId]) {
            delete this.ps[requestId];
            reject(
              new Error(
                `Sandbox message '${message.type}' timed out after ${timeout}ms`
              )
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

        // Fire-and-forget message types
        const fireAndForgetTypes = ["output", "trackInteraction"];
        if (fireAndForgetTypes.includes(message.type)) {
          // Attach catch so unhandled rejection doesn't crash
          Promise.resolve().then(() => {}).catch(() => {});
        }

        // Publish to commands channel
        this.pubnub
          .publish({
            channel: this._channels.commands,
            message,
          })
          .then(() => {
            emitter.emit(events.sandbox.sent, message);
          })
          .catch((err) => {
            clearTimeout(timeoutId);
            this.pendingTimeouts.delete(requestId);
            delete this.ps[requestId];
            reject(
              new Error(`Failed to publish command: ${err.message}`)
            );
          });
      });
    }

    /**
     * Authenticate with the API via REST
     */
    async auth(apiKey) {
      this.apiKey = apiKey;

      try {
        const response = await axios.post(
          `${this.apiRoot}/api/v7/sandbox/authenticate`,
          { apiKey, version },
          { timeout: 30000 }
        );

        if (response.data.success) {
          this.authenticated = true;

          if (response.data.traceId) {
            this.traceId = response.data.traceId;
            logger.log("");
            logger.log(`🔗 Trace Report (Share When Reporting Bugs):`);
            logger.log(
              `https://testdriver.sentry.io/explore/traces/trace/${response.data.traceId}`
            );
          }

          emitter.emit(events.sandbox.authenticated, {
            traceId: response.data.traceId,
          });
          return true;
        }
      } catch (err) {
        const errorMsg =
          err.response?.data?.message || err.message;
        throw new Error(`Authentication failed: ${errorMsg}`);
      }
    }

    /**
     * Create a sandbox and initialize PubNub connection
     */
    async create(options = {}) {
      if (!this.apiKey) {
        throw new Error("Must authenticate before creating a sandbox");
      }

      const os = options.os || "local";

      try {
        const response = await axios.post(
          `${this.apiRoot}/api/v7/sandbox/create`,
          {
            apiKey: this.apiKey,
            os,
            resolution: options.resolution,
            version,
          },
          { timeout: 120000 }
        );

        const data = response.data;
        if (!data.success) {
          throw new Error(data.message || "Failed to create sandbox");
        }

        this._sandboxId = data.sandboxId;
        this._pubnubConfig = data.pubnub;
        this._channels = data.pubnub.channels;
        this._sdkToken = data.pubnub.sdkToken;
        this._runnerToken = data.pubnub.runnerToken;

        // Initialize PubNub
        this._initPubNub();

        return data;
      } catch (err) {
        const errorMsg =
          err.response?.data?.message || err.message;
        throw new Error(`Failed to create sandbox: ${errorMsg}`);
      }
    }

    /**
     * Connect to an existing sandbox via PubNub
     * For compatibility with the existing SDK interface
     */
    async connect(sandboxId, persist = false, keepAlive = null) {
      this._lastConnectParams = { sandboxId, persist, keepAlive };

      // If we already have PubNub config (from create()), use it
      if (this._channels && this._sandboxId === sandboxId) {
        this.instanceSocketConnected = true;
        emitter.emit(events.sandbox.connected);
        return { success: true, sandboxId };
      }

      // Otherwise, request a new token from the API
      if (!this.apiKey) {
        throw new Error("Must authenticate before connecting");
      }

      try {
        const response = await axios.post(
          `${this.apiRoot}/api/v7/sandbox/create`,
          {
            apiKey: this.apiKey,
            os: this.os || "local",
            version,
          },
          { timeout: 120000 }
        );

        const data = response.data;
        this._sandboxId = data.sandboxId;
        this._pubnubConfig = data.pubnub;
        this._channels = data.pubnub.channels;
        this._sdkToken = data.pubnub.sdkToken;
        this._runnerToken = data.pubnub.runnerToken;

        this._initPubNub();

        this.instanceSocketConnected = true;
        emitter.emit(events.sandbox.connected);
        return {
          success: true,
          sandboxId: this._sandboxId,
          sandbox: { sandboxId: this._sandboxId },
        };
      } catch (err) {
        const errorMsg =
          err.response?.data?.message || err.message;
        throw new Error(
          errorMsg || "Failed to connect to sandbox"
        );
      }
    }

    /**
     * Initialize PubNub client and subscribe to response/file channels
     */
    _initPubNub() {
      if (this.pubnub) {
        this.pubnub.unsubscribeAll();
        this.pubnub.stop();
      }

      this.pubnub = new PubNub({
        subscribeKey: this._pubnubConfig.subscribeKey,
        publishKey: this._pubnubConfig.publishKey,
        userId: `sdk-${this._sandboxId}`,
      });

      this.pubnub.setToken(this._sdkToken);

      // Set up runner ready promise
      this._runnerReady = false;
      this._runnerReadyPromise = new Promise((resolve) => {
        this._runnerReadyResolve = resolve;
      });

      // Subscribe to responses and files channels
      this.pubnub.subscribe({
        channels: [this._channels.responses, this._channels.files],
      });

      // Message listener
      this.pubnub.addListener({
        message: (event) => {
          this._handleMessage(event);
        },
        file: (event) => {
          this._handleFileMessage(event);
        },
        status: (event) => {
          this._handleStatus(event);
        },
      });

      this.apiSocketConnected = true;
      logger.log(
        `[Sandbox] PubNub connected. Channels: ${JSON.stringify(this._channels)}`
      );
    }

    /**
     * Handle incoming PubNub messages on the responses channel
     */
    _handleMessage(event) {
      const message = event.message;

      // Runner ready signal (also treat pong as ready)
      if (message.type === "runner.ready" || message.type === "pong") {
        this._runnerReady = true;
        if (this._runnerReadyResolve) {
          this._runnerReadyResolve();
          this._runnerReadyResolve = null;
        }
        logger.log("[Sandbox] Runner is ready");
        return;
      }

      // Progress messages
      if (message.type === "sandbox.progress") {
        emitter.emit(events.sandbox.progress, {
          step: message.step,
          message: message.message,
        });
        return;
      }

      const requestId = message.requestId;
      if (!requestId || !this.ps[requestId]) {
        if (!this.reconnecting) {
          // Expected during reconnection or after timeout
        }
        return;
      }

      // Screenshot response with file reference — need to download
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
        const error = new Error(
          message.errorMessage || "Sandbox error"
        );
        error.responseData = message;
        this.ps[requestId].reject(error);
      } else {
        emitter.emit(events.sandbox.received);
        this.ps[requestId].resolve(message);
      }
      delete this.ps[requestId];
    }

    /**
     * Handle PubNub file events on the files channel
     */
    _handleFileMessage(event) {
      // File events may arrive before or after the response message
      // Store file info for pending screenshot requests
      const msg = event.message;
      if (msg && msg.requestId && this.ps[msg.requestId]) {
        // Download immediately
        this._downloadScreenshot(msg.requestId, {
          fileId: event.file.id,
          fileName: event.file.name,
        });
      }
    }

    /**
     * Download a screenshot file from PubNub and resolve the pending promise
     */
    async _downloadScreenshot(requestId, fileInfo) {
      const pending = this.ps[requestId];
      if (!pending) return;

      try {
        const result = await this.pubnub.downloadFile({
          channel: this._channels.files,
          id: fileInfo.fileId,
          name: fileInfo.fileName,
        });

        const buffer = await result.data.toBuffer();
        const base64 = buffer.toString("base64");

        pending.resolve({
          type: "screenshot.reply",
          requestId,
          base64,
          success: true,
        });
      } catch (err) {
        pending.reject(
          new Error(`Failed to download screenshot: ${err.message}`)
        );
      }
      delete this.ps[requestId];
    }

    /**
     * Handle PubNub status events
     */
    _handleStatus(event) {
      switch (event.category) {
        case "PNConnectedCategory":
          logger.log("[Sandbox] PubNub connected");
          break;
        case "PNReconnectedCategory":
          logger.log("[Sandbox] PubNub reconnected");
          this.reconnecting = false;
          break;
        case "PNAccessDeniedCategory":
          logger.log(
            "[Sandbox] PubNub access denied - token may be expired"
          );
          emitter.emit(
            events.error.sandbox,
            "PubNub access denied - token expired"
          );
          break;
        case "PNNetworkDownCategory":
          logger.log("[Sandbox] Network down");
          this.handleConnectionLoss();
          break;
        default:
          break;
      }
    }

    async handleConnectionLoss() {
      if (this.intentionalDisconnect) return;
      if (this.reconnecting) return;
      this.reconnecting = true;

      // Queue pending requests for retry
      const pendingRequestIds = Object.keys(this.ps);
      if (pendingRequestIds.length > 0) {
        console.log(
          `[Sandbox] Queuing ${pendingRequestIds.length} pending request(s) for retry after reconnection`
        );
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
        const errorMsg =
          "Unable to reconnect to TestDriver sandbox after multiple attempts.";
        emitter.emit(events.error.sandbox, errorMsg);
        console.error(errorMsg);

        if (this.pendingRetryQueue.length > 0) {
          for (const queued of this.pendingRetryQueue) {
            queued.reject(
              new Error("Sandbox reconnection failed")
            );
          }
          this.pendingRetryQueue = [];
        }
        this.reconnecting = false;
        return;
      }

      this.reconnectAttempts++;
      const delay = Math.min(
        1000 * 2 ** (this.reconnectAttempts - 1),
        60000
      );

      console.log(
        `[Sandbox] Connection lost. Reconnecting in ${delay}ms... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );

      this.reconnectTimer = setTimeout(async () => {
        this.reconnectTimer = null;
        try {
          // PubNub SDK auto-reconnects, but we may need to refresh token
          if (this.apiKey && this._lastConnectParams) {
            await this.auth(this.apiKey);
            const { sandboxId, persist, keepAlive } =
              this._lastConnectParams;
            await this.connect(sandboxId, persist, keepAlive);
          }
          console.log("[Sandbox] Reconnected successfully.");
          await this._retryQueuedRequests();
        } catch (e) {
          // Will retry via next handleConnectionLoss
        } finally {
          this.reconnecting = false;
        }
      }, delay);
    }

    async _retryQueuedRequests() {
      if (this.pendingRetryQueue.length === 0) return;

      console.log(
        `[Sandbox] Retrying ${this.pendingRetryQueue.length} queued request(s)...`
      );
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

    /**
     * Boot the sandbox connection.
     * In PubNub mode, this just stores the API root.
     * The actual PubNub connection happens in create()/connect().
     */
    async boot(apiRoot) {
      if (apiRoot) this.apiRoot = apiRoot;
      this.apiSocketConnected = true;
      this.reconnectAttempts = 0;
      this.reconnecting = false;
      return this;
    }

    /**
     * Wait for the runner to be ready
     * @param {number} timeout - Max wait time in ms (default 60s)
     */
    async waitForRunner(timeout = 60000) {
      if (this._runnerReady) return;
      if (!this.pubnub || !this._channels) {
        throw new Error("Not connected to PubNub");
      }

      // Poll the runner with pings until we get a pong or runner.ready
      await new Promise((resolve, reject) => {
        const deadline = setTimeout(() => {
          clearInterval(pollInterval);
          reject(new Error("Runner did not become ready within timeout"));
        }, timeout);

        // Poll every 2s
        const pollInterval = setInterval(() => {
          if (this._runnerReady) {
            clearTimeout(deadline);
            clearInterval(pollInterval);
            return resolve();
          }
          this.pubnub.publish({
            channel: this._channels.commands,
            message: { type: 'ping', requestId: `ping-${Date.now()}` },
          }).catch(() => {});
        }, 2000);

        // Also check if already ready
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

    /**
     * Get the runner PubNub token (for passing to a local runner process)
     */
    getRunnerConfig() {
      if (!this._pubnubConfig) {
        throw new Error("No PubNub config available. Call create() first.");
      }
      return {
        subscribeKey: this._pubnubConfig.subscribeKey,
        publishKey: this._pubnubConfig.publishKey,
        token: this._runnerToken,
        sandboxId: this._sandboxId,
        channels: this._channels,
      };
    }

    /**
     * Close the PubNub connection and clean up
     */
    close() {
      this.intentionalDisconnect = true;
      this.reconnecting = false;

      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      // Clear pending timeouts
      for (const timeoutId of this.pendingTimeouts.values()) {
        clearTimeout(timeoutId);
      }
      this.pendingTimeouts.clear();

      // Clean up PubNub
      if (this.pubnub) {
        try {
          this.pubnub.unsubscribeAll();
          this.pubnub.stop();
        } catch (err) {
          // Ignore
        }
        this.pubnub = null;
      }

      this.apiSocketConnected = false;
      this.instanceSocketConnected = false;
      this.authenticated = false;
      this.instance = null;

      // Silently clear pending promises
      this.ps = {};
      this.pendingRetryQueue = [];
    }
  }

  return new Sandbox();
};

module.exports = { createSandbox };
