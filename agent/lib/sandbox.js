const Redis = require("ioredis");
const axios = require("axios");
const { events } = require("../events");
const logger = require("./logger");
const { version } = require("../../package.json");
const { withRetry, getSentryTraceHeaders } = require("./sdk");
const sentry = require("../../lib/sentry");

const createSandbox = function (emitter, analytics, sessionInstance) {
  class Sandbox {
    constructor() {
      this._redis = null;
      this._redisReader = null;
      this._streamNames = null;
      this._redisStopped = false;
      this._controlHandlers = [];
      this.ps = {};
      this._execBuffers = {}; // accumulate streamed exec.output chunks per requestId
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
      this.apiRoot = null;
      this.apiKey = null;
      this._lastConnectParams = null;
      this._teamId = null;
      this._sandboxId = null;
    }

    getTraceId() {
      return this.traceId;
    }

    getTraceUrl() {
      if (!this.traceId) return null;
      return (
        "https://testdriver.sentry.io/explore/traces/trace/" + this.traceId
      );
    }

    async _initRedis(redisUrl, streamNames) {
      // Tear down any existing connection
      if (this._redis || this._redisReader) {
        this._redisStopped = true;
        try { this._redis && this._redis.disconnect(); } catch (e) { /* ignore */ }
        try { this._redisReader && this._redisReader.disconnect(); } catch (e) { /* ignore */ }
        this._redis = null;
        this._redisReader = null;
      }

      this._streamNames = streamNames;
      this._redisStopped = false;
      var self = this;

      // Shared retry strategy: exponential backoff up to 5s, stop on intentional close
      var makeRetryStrategy = function () {
        return function (times) {
          if (self._redisStopped) return null; // stop retrying on intentional close
          return Math.min(times * 500, 5000);
        };
      };

      // Publisher connection: offline queue enabled so commands are buffered during
      // brief reconnects; maxRetriesPerRequest limits per-call retries.
      var redisOpts = {
        lazyConnect: false,
        retryStrategy: makeRetryStrategy(),
        enableOfflineQueue: true,
        maxRetriesPerRequest: 3,
      };

      this._redis = new Redis(redisUrl, redisOpts);

      // Reader uses separate connection — XREAD BLOCK ties up the connection.
      // Offline queue is disabled so a reconnect causes the blocking XREAD to
      // fail immediately and the poll loop can restart cleanly.
      this._redisReader = new Redis(redisUrl, {
        lazyConnect: false,
        retryStrategy: makeRetryStrategy(),
        enableOfflineQueue: false,
        maxRetriesPerRequest: 0,
      });

      await new Promise(function (resolve, reject) {
        var timer = setTimeout(function () {
          reject(new Error("Redis connection timeout"));
        }, 30000);
        if (timer.unref) timer.unref();
        self._redis.once("ready", function () {
          clearTimeout(timer);
          resolve();
        });
        self._redis.once("error", function (err) {
          clearTimeout(timer);
          reject(new Error("Redis connection failed: " + err.message));
        });
      });

      this._redis.on("error", function (err) {
        if (!self._redisStopped) {
          logger.error("Redis connection error: " + err.message);
        }
      });

      this._redis.on("reconnecting", function () {
        logger.log("Redis reconnecting...");
      });

      this._redis.on("connect", function () {
        logger.log("Redis reconnected");
      });

      this._redisReader.on("error", function (err) {
        if (!self._redisStopped) {
          logger.error("Redis reader error: " + err.message);
        }
      });

      this.heartbeat = setInterval(function () {}, 5000);
      if (this.heartbeat.unref) this.heartbeat.unref();

      // Start the combined poll loop for responses, files, and control streams
      this._startPollLoop();
    }

    /**
     * Single blocking XREAD loop that fans messages out to the three
     * per-stream handlers.  Uses one Redis connection so we stay within
     * a small connection footprint.
     *
     * control starts from '0' so we catch any runner.ready messages that
     * were written before we connected (stream history check).
     * Per-sandbox control streams are short-lived and small, so reading from
     * the beginning is safe and avoids a separate history lookup.
     * responses / files start from '$' — we only care about new messages.
     */
    _startPollLoop() {
      var self = this;
      var lastResponseId = "$";
      var lastFilesId = "$";
      var lastControlId = "0"; // read from beginning to catch history

      // Batch size per XREAD call. 100 provides a good balance between
      // throughput and memory; no per-connection rate limit with Redis.
      var batchSize = 100;

      (async function poll() {
        while (!self._redisStopped) {
          try {
            var results = await self._redisReader.xread(
              "BLOCK", 5000,
              "COUNT", batchSize,
              "STREAMS",
              self._streamNames.responses,
              self._streamNames.files,
              self._streamNames.control,
              lastResponseId,
              lastFilesId,
              lastControlId,
            );

            if (!results) continue; // timeout — no new messages

            for (var i = 0; i < results.length; i++) {
              var streamKey = results[i][0];
              var entries = results[i][1];
              for (var j = 0; j < entries.length; j++) {
                var id = entries[j][0];
                var fields = entries[j][1];
                var dataIdx = fields.indexOf("data");
                if (dataIdx < 0) continue;
                try {
                  var message = JSON.parse(fields[dataIdx + 1]);
                  if (streamKey === self._streamNames.responses) {
                    lastResponseId = id;
                    self._handleResponseMessage(message);
                  } else if (streamKey === self._streamNames.files) {
                    lastFilesId = id;
                    self._handleFileMessage(message);
                  } else if (streamKey === self._streamNames.control) {
                    lastControlId = id;
                    self._handleControlMessage(message);
                  }
                } catch (parseErr) {
                  logger.warn("Failed to parse Redis stream message: " + parseErr.message);
                }
              }
            }
          } catch (e) {
            if (self._redisStopped) break;
            logger.error("Redis stream poll error: " + e.message);
            // Brief backoff before retrying
            await new Promise(function (r) {
              var t = setTimeout(r, 1000);
              if (t.unref) t.unref();
            });
          }
        }
      })();
    }

    _handleResponseMessage(message) {
      var self = this;
      if (!message) return;

      if (message.type === "sandbox.progress") {
        emitter.emit(events.sandbox.progress, {
          step: message.step,
          message: message.message,
        });
        return;
      }

      if (
        message.type === "before.file" ||
        message.type === "after.file" ||
        message.type === "screenshot.file"
      ) {
        emitter.emit(events.sandbox.file, message);
        return;
      }

      // Streaming exec output chunks — accumulate per requestId so the
      // full stdout can be reconstructed when the final response arrives.
      if (message.type === "exec.output") {
        if (message.requestId) {
          if (!self._execBuffers[message.requestId]) {
            self._execBuffers[message.requestId] = "";
          }
          self._execBuffers[message.requestId] += (message.chunk || "");
        }
        emitter.emit(events.exec.output, { chunk: message.chunk, requestId: message.requestId });
        return;
      }

      // Runner debug logs — only received when debug mode is enabled
      if (message.type === "runner.log") {
        var logLevel = message.level || "info";
        var logMsg = "[runner] " + (message.message || "");
        if (logLevel === "error") {
          logger.error(logMsg);
        } else {
          logger.log(logMsg);
        }
        emitter.emit(events.runner.log, {
          level: logLevel,
          message: message.message,
          timestamp: message.timestamp,
        });
        return;
      }

      if (!message.requestId || !self.ps[message.requestId]) {
        var debugMode = process.env.VERBOSE || process.env.TD_DEBUG;
        if (debugMode) {
          console.warn(
            "No pending promise found for requestId:",
            message.requestId,
          );
        }
        return;
      }

      if (message.error) {
        var pendingMessage =
          self.ps[message.requestId] &&
          self.ps[message.requestId].message;
        if (!pendingMessage || pendingMessage.type !== "output") {
          emitter.emit(events.error.sandbox, message.errorMessage);
        }
        var error = new Error(message.errorMessage || "Sandbox error");
        error.responseData = message;
        delete self._execBuffers[message.requestId];
        self.ps[message.requestId].reject(error);
      } else {
        emitter.emit(events.sandbox.received);
        if (self.ps[message.requestId]) {
          // Unwrap the result from the response envelope
          // The runner sends { requestId, type, result, success }
          // But SDK commands expect just the result object
          var resolvedValue = message.result !== undefined ? message.result : message;

          // For exec (commands.run): the runner streams stdout via exec.output
          // chunks and sends only returncode+stderr in the final response.
          // Reconstruct stdout from the accumulated buffer.
          var streamedStdout = self._execBuffers[message.requestId];
          if (streamedStdout !== undefined && resolvedValue && resolvedValue.out) {
            resolvedValue.out.stdout = streamedStdout;
          }
          delete self._execBuffers[message.requestId];

          self.ps[message.requestId].resolve(resolvedValue);
        }
      }
      delete self.ps[message.requestId];
    }

    _handleFileMessage(message) {
      var self = this;
      if (!message) return;
      if (message.requestId && self.ps[message.requestId]) {
        emitter.emit(events.sandbox.received);
        self.ps[message.requestId].resolve(message);
        delete self.ps[message.requestId];
      }
      emitter.emit(events.sandbox.file, message);
    }

    _handleControlMessage(message) {
      if (!message) return;
      // Notify all registered one-shot control handlers (e.g. runner.ready waiters)
      var remaining = [];
      for (var i = 0; i < this._controlHandlers.length; i++) {
        var handled = this._controlHandlers[i](message);
        if (!handled) {
          remaining.push(this._controlHandlers[i]);
        }
      }
      this._controlHandlers = remaining;
    }

    /**
     * POST to the API with retry for transient network errors (via withRetry)
     * and infinite polling for CONCURRENCY_LIMIT_EXCEEDED (until vitest's
     * testTimeout kills the test).
     */
    async _httpPostWithConcurrencyRetry(path, body, timeout) {
      var concurrencyRetryInterval = 10000; // 10 seconds between concurrency retries
      var startTime = Date.now();
      var sessionId = this.sessionInstance ? this.sessionInstance.get() : null;

      var self = this;
      var makeRequest = function () {
        return axios({
          method: "post",
          url: self.apiRoot + path,
          data: body,
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "TestDriverSDK/" + version + " (Node.js " + process.version + ")",
            ...getSentryTraceHeaders(sessionId),
          },
          timeout: timeout || 120000,
        });
      };

      while (true) {
        try {
          var response = await withRetry(makeRequest, {
            retryConfig: {
              maxRetries: 3,
              baseDelayMs: 2000,
              retryableStatusCodes: [500, 502, 503, 504], // Don't retry 429 — handled below
            },
            onRetry: function (attempt, error, delayMs) {
              var elapsed = Date.now() - startTime;
              logger.warn(
                "Transient network error: " + (error.message || error.code) +
                  " — POST " + path +
                  " — retry " + attempt + "/3" +
                  " in " + (delayMs / 1000).toFixed(1) + "s" +
                  " (" + Math.round(elapsed / 1000) + "s elapsed)...",
              );
            },
          });
          return response.data;
        } catch (err) {
          // Concurrency limit — poll forever until a slot opens
          var responseData = err.response && err.response.data;
          if (responseData && responseData.errorCode === "CONCURRENCY_LIMIT_EXCEEDED") {
            var elapsed = Date.now() - startTime;
            logger.log(
              "Concurrency limit reached — waiting " +
                concurrencyRetryInterval / 1000 +
                "s for a slot to become available (" +
                Math.round(elapsed / 1000) +
                "s elapsed)...",
            );
            await new Promise(function (resolve) {
              var t = setTimeout(resolve, concurrencyRetryInterval);
              if (t.unref) t.unref();
            });
            continue;
          }

          // Non-retryable HTTP error — preserve responseData for callers
          if (responseData) {
            var httpErr = new Error(
              responseData.errorMessage || responseData.message || "HTTP " + err.response.status,
            );
            httpErr.responseData = responseData;
            throw httpErr;
          }

          throw err;
        }
      }
    }

    send(message, timeout) {
      if (timeout === undefined) timeout = 300000;
      if (message.type === "create" || message.type === "direct") {
        return this._sendHttp(message, timeout);
      }
      return this._sendRedis(message, timeout);
    }

    async _sendHttp(message, timeout) {
      var sessionId = this.sessionInstance
        ? this.sessionInstance.get()
        : null;
      var body = {
        apiKey: this.apiKey,
        version: version,
        os: message.os || this.os,
        session: sessionId,
        apiRoot: this.apiRoot,
      };

      if (message.type === "create") {
        body.os = message.os || this.os || "linux";
        body.resolution = message.resolution;
        body.ci = message.ci;
        if (message.ami) body.ami = message.ami;
        if (message.instanceType) body.instanceType = message.instanceType;
        if (message.keepAlive !== undefined) body.keepAlive = message.keepAlive;
      }

      if (message.type === "direct") {
        body.ip = message.ip;
        body.resolution = message.resolution;
        body.ci = message.ci;
        if (message.instanceId) body.instanceId = message.instanceId;
      }

      var reply = await this._httpPostWithConcurrencyRetry(
        "/api/v7/sandbox/authenticate",
        body,
        timeout,
      );

      if (!reply.success) {
        var err = new Error(
          reply.errorMessage || "Failed to allocate sandbox",
        );
        err.responseData = reply;
        throw err;
      }

      this._sandboxId = reply.sandboxId;
      this._teamId = reply.teamId;

      if (reply.redis && reply.redis.url) {
        await this._initRedis(reply.redis.url, reply.redis.streams);
        this.instanceSocketConnected = true;

        // Tell the runner to enable debug log forwarding if debug mode is on
        var debugMode =
          process.env.VERBOSE || process.env.TD_DEBUG;
        if (debugMode && this._redis) {
          this._redis.xadd(
            this._streamNames.control, "*", "data",
            JSON.stringify({ type: "debug", enabled: true }),
          ).catch(function (err) { logger.warn("Failed to enable runner debug forwarding: " + err.message); });
        }
      }

      if (message.type === "create") {
        // E2B (Linux) sandboxes: the API proxies commands and returns a url directly.
        // No runner agent involved — skip runner.ready wait.
        if (reply.url) {
          logger.log(`E2B sandbox ready — url=${reply.url}`);
          return {
            success: true,
            sandbox: {
              sandboxId: reply.sandboxId,
              instanceId: reply.sandbox?.sandboxId || reply.sandboxId,
              os: body.os || 'linux',
              url: reply.url,
            },
          };
        }

        const runnerIp = reply.runner && reply.runner.ip;
        const noVncPort = reply.runner && reply.runner.noVncPort;
        const runnerVncUrl = reply.runner && reply.runner.vncUrl;

        logger.log(`Runner claimed — ip=${runnerIp || 'none'}, os=${reply.runner?.os || 'unknown'}, noVncPort=${noVncPort || 'not reported'}, vncUrl=${runnerVncUrl || 'not reported'}`);

        // For cloud Windows sandboxes (no runner in reply), wait for the
        // agent to signal readiness before sending commands.  Without this
        // gate, commands published before the agent subscribes are lost.
        var self = this;
        if (!reply.runner && this._redis) {
          logger.log('Waiting for runner agent to signal readiness...');
          var readyTimeout = 120000; // 120s — allows for EC2 boot + agent startup
          await new Promise(function (resolve, reject) {
            var resolved = false;
            function finish(data) {
              if (resolved) return;
              resolved = true;
              clearTimeout(timer);
              // Update runner info if provided
              if (data && data.os) reply.runner = reply.runner || {};
              if (data && data.os && reply.runner) reply.runner.os = data.os;
              if (data && data.ip && reply.runner) reply.runner.ip = data.ip;
              if (data && data.runnerVersion && reply.runner) reply.runner.version = data.runnerVersion;
              logger.log('Runner agent ready (os=' + ((data && data.os) || 'unknown') + ', runner v' + ((data && data.runnerVersion) || 'unknown') + ')');
              if (data && data.update) {
                var u = data.update;
                if (u.status === 'up-to-date') {
                  logger.log('Runner is up to date (v' + u.localVersion + ')');
                } else if (u.status === 'updated') {
                  logger.log('Runner was auto-updated: v' + u.localVersion + ' \u2192 v' + u.remoteVersion);
                } else if (u.status === 'available:major') {
                  logger.warn('Runner update available but not auto-installed (major/minor): v' + u.localVersion + ' \u2192 v' + u.remoteVersion);
                } else if (u.status && u.status.startsWith('error:')) {
                  logger.warn('Runner update check failed: ' + u.status.slice(6));
                }
              }
              resolve();
            }

            var timer = setTimeout(function () {
              if (!resolved) {
                resolved = true;
                // Remove our handler
                self._controlHandlers = self._controlHandlers.filter(function (h) { return h !== onCtrl; });
                var err = new Error('Runner agent did not signal readiness within ' + readyTimeout + 'ms');
                sentry.captureException(err, {
                  tags: { phase: 'runner_ready', connection_type: 'create' },
                  extra: { readyTimeout: readyTimeout, sandboxId: reply.sandboxId },
                });
                reject(err);
              }
            }, readyTimeout);
            if (timer.unref) timer.unref();

            // Register a one-shot control handler.
            // The poll loop starts from '0' so historical messages are also delivered,
            // catching runner.ready messages written before we subscribed.
            function onCtrl(data) {
              if (data && data.type === 'runner.ready') {
                finish(data);
                return true; // remove handler
              }
              return false; // keep handler
            }
            self._controlHandlers.push(onCtrl);
          });
        }
        // Prefer the full vncUrl reported by the runner (infrastructure-agnostic).
        // Fall back to constructing from ip + noVncPort for older runners.
        let url;
        if (runnerVncUrl) {
          url = runnerVncUrl;
          logger.log(`Using runner-provided vncUrl: ${url}`);
        } else if (runnerIp && noVncPort) {
          url = `http://${runnerIp}:${noVncPort}/vnc_lite.html?token=V3b8wG9`;
          logger.log(`noVNC URL constructed from runner ip+port: ${url}`);
        } else if (runnerIp) {
          url = "http://" + runnerIp;
          logger.warn(`Runner did not report noVNC port — using bare IP: ${url}`);
        } else {
          logger.warn('Runner has no IP — preview will not be available');
        }
        return {
          success: true,
          sandbox: {
            sandboxId: reply.sandboxId,
            instanceId: reply.sandboxId,
            os: reply.runner?.os || body.os,
            ip: runnerIp,
            url: url,
            vncPort: noVncPort || undefined,
            runner: reply.runner,
          },
        };
      }

      if (message.type === "direct") {
        // If the API returned agent config and we have an instanceId,
        // provision the config to the instance via SSM (client-side).
        // This runs from the user's infrastructure where AWS permissions exist,
        // rather than from the API server.
        if (reply.agentConfig && message.instanceId) {
          logger.log('Provisioning agent config to instance ' + message.instanceId + ' via SSM...');
          await this._provisionAgentConfig(message.instanceId, reply.agentConfig);
          logger.log('Agent config provisioned successfully.');
        }

        // If the API returned agent credentials (reply.agent present),
        // wait for the runner agent to signal readiness before sending commands.
        // Without this gate, commands published before the agent subscribes are lost.
        var self = this;
        if (reply.agent && this._redis) {
          logger.log('Waiting for runner agent to signal readiness (direct connection)...');
          var readyTimeout = 120000; // 120s — allows for SSM provisioning + agent startup
          await new Promise(function (resolve, reject) {
            var resolved = false;
            function finish(data) {
              if (resolved) return;
              resolved = true;
              clearTimeout(timer);
              logger.log('Runner agent ready (direct, os=' + ((data && data.os) || 'unknown') + ', runner v' + ((data && data.runnerVersion) || 'unknown') + ')');
              if (data && data.update) {
                var u = data.update;
                if (u.status === 'up-to-date') {
                  logger.log('Runner is up to date (v' + u.localVersion + ')');
                } else if (u.status === 'updated') {
                  logger.log('Runner was auto-updated: v' + u.localVersion + ' \u2192 v' + u.remoteVersion);
                } else if (u.status === 'available:major') {
                  logger.warn('Runner update available but not auto-installed (major/minor): v' + u.localVersion + ' \u2192 v' + u.remoteVersion);
                } else if (u.status && u.status.startsWith('error:')) {
                  logger.warn('Runner update check failed: ' + u.status.slice(6));
                }
              }
              resolve();
            }

            var timer = setTimeout(function () {
              if (!resolved) {
                resolved = true;
                self._controlHandlers = self._controlHandlers.filter(function (h) { return h !== onCtrl; });
                var err = new Error('Runner agent did not signal readiness within ' + readyTimeout + 'ms (direct connection)');
                sentry.captureException(err, {
                  tags: { phase: 'runner_ready', connection_type: 'direct' },
                  extra: { readyTimeout: readyTimeout, sandboxId: reply.sandboxId, instanceId: message.instanceId },
                });
                reject(err);
              }
            }, readyTimeout);
            if (timer.unref) timer.unref();

            // Register a one-shot control handler.
            // The poll loop starts from '0' so historical messages are also delivered.
            function onCtrl(data) {
              if (data && data.type === 'runner.ready') {
                finish(data);
                return true; // remove handler
              }
              return false; // keep handler
            }
            self._controlHandlers.push(onCtrl);
          });
        }

        // Construct VNC URL — use port 8080 (nginx noVNC proxy) for Windows instances
        var directUrl = message.ip ? "http://" + message.ip + ":8080/vnc_lite.html?token=V3b8wG9" : undefined;

        return {
          success: true,
          instance: {
            instanceId: reply.sandboxId,
            sandboxId: reply.sandboxId,
            ip: message.ip,
            url: directUrl || "http://" + message.ip,
          },
        };
      }

      return reply;
    }

    _sendRedis(message, timeout) {
      if (timeout === undefined) timeout = 300000;

      if (!this._redis || !this._streamNames) {
        return Promise.reject(
          new Error("Sandbox not connected (no Redis client)"),
        );
      }

      this.messageId++;
      message.requestId = this.uniqueId + "-" + this.messageId;

      if (message.os) this.os = message.os;
      if (this.os && !message.os) message.os = this.os;

      if (this.sessionInstance && !message.session) {
        var sessionId = this.sessionInstance.get();
        if (sessionId) message.session = sessionId;
      }

      if (
        this._lastConnectParams &&
        this._lastConnectParams.sandboxId &&
        !message.sandboxId
      ) {
        var id = this._lastConnectParams.sandboxId;
        if (id && !/^\d+\.\d+\.\d+\.\d+$/.test(id)) {
          message.sandboxId = id;
        }
      }

      // Attach Sentry distributed trace headers for runner-side tracing
      var traceSessionId = this.sessionInstance
        ? this.sessionInstance.get()
        : message.session;
      if (traceSessionId) {
        var traceHeaders = getSentryTraceHeaders(traceSessionId);
        if (traceHeaders["sentry-trace"]) {
          message.sentryTrace = traceHeaders["sentry-trace"];
          message.baggage = traceHeaders.baggage;
        }
      }

      var resolvePromise, rejectPromise;
      var self = this;

      var p = new Promise(function (resolve, reject) {
        resolvePromise = resolve;
        rejectPromise = reject;
      });

      var requestId = message.requestId;

      var timeoutId = setTimeout(function () {
        if (self.ps[requestId]) {
          delete self.ps[requestId];
          delete self._execBuffers[requestId];
          rejectPromise(
            new Error(
              "Sandbox message '" +
                message.type +
                "' timed out after " +
                timeout +
                "ms",
            ),
          );
        }
      }, timeout);
      if (timeoutId.unref) timeoutId.unref();

      this.ps[requestId] = {
        promise: p,
        resolve: function (result) {
          clearTimeout(timeoutId);
          resolvePromise(result);
        },
        reject: function (error) {
          clearTimeout(timeoutId);
          rejectPromise(error);
        },
        message: message,
        startTime: Date.now(),
      };

      if (message.type === "output") {
        p.catch(function () {});
      }

      // Publish command to the Redis commands stream
      this._redis.xadd(this._streamNames.commands, "*", "data", JSON.stringify(message))
        .then(function () {
          emitter.emit(events.sandbox.sent, message);
        })
        .catch(function (err) {
          if (self.ps[requestId]) {
            clearTimeout(timeoutId);
            delete self.ps[requestId];
            rejectPromise(
              new Error("Failed to send message: " + err.message),
            );
          }
        });

      return p;
    }

    async auth(apiKey) {
      this.apiKey = apiKey;
      var sessionId = this.sessionInstance
        ? this.sessionInstance.get()
        : null;

      var reply = await this._httpPostWithConcurrencyRetry(
        "/api/v7/sandbox/authenticate",
        {
          apiKey: apiKey,
          version: version,
          session: sessionId,
        },
      );

      if (reply.success) {
        this.authenticated = true;
        this.apiSocketConnected = true;
        this._teamId = reply.teamId;

        if (reply.traceId) {
          this.traceId = reply.traceId;
          logger.log("");
          logger.log("Trace Report (Share When Reporting Bugs):");
          logger.log(
            "https://testdriver.sentry.io/explore/traces/trace/" +
              reply.traceId,
          );
        }

        emitter.emit(events.sandbox.authenticated, {
          traceId: reply.traceId,
        });
        return true;
      }

      return false;
    }

    setConnectionParams(params) {
      this._lastConnectParams = params ? Object.assign({}, params) : null;
    }

    async connect(sandboxId, persist, keepAlive) {
      if (persist === undefined) persist = false;
      if (keepAlive === undefined) keepAlive = null;
      var sessionId = this.sessionInstance
        ? this.sessionInstance.get()
        : null;

      var reply = await this._httpPostWithConcurrencyRetry(
        "/api/v7/sandbox/authenticate",
        {
          apiKey: this.apiKey,
          version: version,
          sandboxId: sandboxId,
          session: sessionId,
          keepAlive: keepAlive || undefined,
        },
      );

      if (!reply.success) {
        this.setConnectionParams(null);
        throw new Error(reply.errorMessage || "Failed to connect to sandbox");
      }

      this._sandboxId = reply.sandboxId;

      if (reply.redis && reply.redis.url) {
        await this._initRedis(reply.redis.url, reply.redis.streams);
      }

      this.setConnectionParams({
        sandboxId: sandboxId,
        persist: persist,
        keepAlive: keepAlive,
      });
      this.instanceSocketConnected = true;
      emitter.emit(events.sandbox.connected);

      // Prefer runner-provided vncUrl, fall back to ip+port, then bare IP
      const reconnectRunner = reply.runner || {};
      const reconnectVncUrl = reconnectRunner.vncUrl;
      const reconnectNoVncPort = reconnectRunner.noVncPort;
      const reconnectIp = reconnectRunner.ip;
      let reconnectUrl;
      if (reconnectVncUrl) {
        reconnectUrl = reconnectVncUrl;
      } else if (reconnectIp && reconnectNoVncPort) {
        reconnectUrl = `http://${reconnectIp}:${reconnectNoVncPort}/vnc_lite.html`;
      } else if (reconnectIp) {
        reconnectUrl = "http://" + reconnectIp;
      }

      return {
        success: true,
        url: reconnectUrl,
        sandbox: {
          sandboxId: reply.sandboxId,
          instanceId: reply.sandboxId,
          os: reconnectRunner.os || undefined,
          ip: reconnectIp || undefined,
          url: reconnectUrl,
          vncPort: reconnectNoVncPort || undefined,
        },
      };
    }

    async boot(apiRoot) {
      if (apiRoot) this.apiRoot = apiRoot;
      return this;
    }

    async close() {
      if (this.heartbeat) {
        clearInterval(this.heartbeat);
        this.heartbeat = null;
      }

      // Stop the poll loop before disconnecting
      this._redisStopped = true;
      this._controlHandlers = [];

      // Send end-session control message to runner before disconnecting
      if (this._redis && this._streamNames && this._streamNames.control) {
        try {
          await this._redis.xadd(
            this._streamNames.control, "*", "data",
            JSON.stringify({ type: "end-session" }),
          );
        } catch (e) {
          // Ignore - best effort
        }
      }

      if (this._redisReader) {
        try {
          this._redisReader.disconnect();
        } catch (e) {
          /* ignore */
        }
        this._redisReader = null;
      }

      if (this._redis) {
        try {
          this._redis.disconnect();
        } catch (e) {
          /* ignore */
        }
        this._redis = null;
      }

      this._streamNames = null;
      this.apiSocketConnected = false;
      this.instanceSocketConnected = false;
      this.authenticated = false;
      this.instance = null;
      this._lastConnectParams = null;
      this.ps = {};
    }

    /**
     * Write the agent config JSON to an EC2 instance via AWS SSM.
     * Runs client-side so the API doesn't need AWS permissions on user infra.
     */
    async _provisionAgentConfig(instanceId, agentConfig) {
      const { execSync } = require('child_process');
      const { writeFileSync, unlinkSync } = require('fs');
      const { join } = require('path');
      const { tmpdir } = require('os');

      const configJson = JSON.stringify(agentConfig);
      const region = process.env.AWS_REGION || 'us-east-2';

      // Write SSM parameters to a temp file to avoid shell quoting issues
      const paramsJson = JSON.stringify({
        commands: [
          "$config = '" + configJson.replace(/'/g, "''") + "'",
          "[System.IO.File]::WriteAllText('C:\\Windows\\Temp\\testdriver-agent.json', $config)",
          "Write-Host 'Config written for sandbox " + agentConfig.sandboxId + "'",
        ],
      });
      const tmpFile = join(tmpdir(), 'td-provision-' + Date.now() + '.json');
      writeFileSync(tmpFile, paramsJson);

      try {
        const output = execSync(
          'aws ssm send-command --region "' + region + '" --instance-ids "' + instanceId + '" ' +
          '--document-name "AWS-RunPowerShellScript" ' +
          '--parameters file://' + tmpFile + ' --output json',
          { encoding: 'utf-8', timeout: 30000 }
        );
        const cmdId = JSON.parse(output).Command.CommandId;
        logger.log('SSM command sent: ' + cmdId);

        // Wait for the command to complete
        execSync(
          'aws ssm wait command-executed --region "' + region + '" ' +
          '--command-id "' + cmdId + '" --instance-id "' + instanceId + '"',
          { encoding: 'utf-8', timeout: 60000 }
        );
      } finally {
        try { unlinkSync(tmpFile); } catch (e) { /* ignore */ }
      }
    }
  }

  return new Sandbox();
};

module.exports = { createSandbox };
