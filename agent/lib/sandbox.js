const crypto = require("crypto");
const Ably = require("ably");
const { events } = require("../events");
const logger = require("./logger");
const { version } = require("../../package.json");

function getSentryTraceHeaders(sessionId) {
  if (!sessionId) return {};
  const traceId = crypto.createHash("md5").update(sessionId).digest("hex");
  const spanId = crypto.randomBytes(8).toString("hex");
  return {
    "sentry-trace": traceId + "-" + spanId + "-1",
    baggage:
      "sentry-trace_id=" +
      traceId +
      ",sentry-sample_rate=1.0,sentry-sampled=true",
  };
}

function httpPost(apiRoot, path, body, timeout) {
  const http = require("http");
  const https = require("https");
  const url = new URL(apiRoot + path);
  const transport = url.protocol === "https:" ? https : http;
  const bodyStr = JSON.stringify(body);

  return new Promise(function (resolve, reject) {
    var timeoutId = timeout
      ? setTimeout(function () {
          req.destroy();
          reject(
            new Error("HTTP request timed out after " + timeout + "ms"),
          );
        }, timeout)
      : null;

    var req = transport.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyStr),
          "Connection": "close",
        },
      },
      function (res) {
        var data = "";
        res.on("data", function (chunk) {
          data += chunk;
        });
        res.on("end", function () {
          if (timeoutId) clearTimeout(timeoutId);
          try {
            var parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              var err = new Error(
                parsed.errorMessage ||
                  parsed.message ||
                  "HTTP " + res.statusCode,
              );
              err.responseData = parsed;
              reject(err);
            } else {
              resolve(parsed);
            }
          } catch (e) {
            reject(new Error("Failed to parse API response: " + data));
          }
        });
      },
    );
    req.on("error", function (err) {
      if (timeoutId) clearTimeout(timeoutId);
      reject(err);
    });
    req.write(bodyStr);
    req.end();
  });
}

const createSandbox = function (emitter, analytics, sessionInstance) {
  class Sandbox {
    constructor() {
      this._ably = null;
      this._cmdChannel = null;
      this._respChannel = null;
      this._ctrlChannel = null;
      this._filesChannel = null;
      this._channelNames = null;
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

    async _initAbly(ablyToken, channelNames) {
      if (this._ably) {
        try {
          this._ably.close();
        } catch (e) {
          /* ignore */
        }
      }
      this._channelNames = channelNames;
      var self = this;

      this._ably = new Ably.Realtime({
        authCallback: function (tokenParams, callback) {
          callback(null, ablyToken);
        },
        clientId: "sdk-" + this._sandboxId,
      });

      await new Promise(function (resolve, reject) {
        self._ably.connection.on("connected", resolve);
        self._ably.connection.on("failed", function () {
          reject(new Error("Ably connection failed"));
        });
        setTimeout(function () {
          reject(new Error("Ably connection timeout"));
        }, 30000);
      });

      this._cmdChannel = this._ably.channels.get(channelNames.commands);
      this._respChannel = this._ably.channels.get(channelNames.responses);
      this._ctrlChannel = this._ably.channels.get(channelNames.control);
      this._filesChannel = this._ably.channels.get(channelNames.files);

      this._respChannel.subscribe("response", function (msg) {
        var message = msg.data;
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

        // Streaming exec output chunks — emit as events, don't resolve the pending promise
        if (message.type === "exec.output") {
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
          var debugMode =
            process.env.VERBOSE || process.env.DEBUG || process.env.TD_DEBUG;
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
          self.ps[message.requestId].reject(error);
        } else {
          emitter.emit(events.sandbox.received);
          if (self.ps[message.requestId]) {
            // Unwrap the result from the Ably response envelope
            // The runner sends { requestId, type, result, success }
            // But SDK commands expect just the result object
            var resolvedValue = message.result !== undefined ? message.result : message;
            self.ps[message.requestId].resolve(resolvedValue);
          }
        }
        delete self.ps[message.requestId];
      });

      this._filesChannel.subscribe("response", function (msg) {
        var message = msg.data;
        if (!message) return;
        if (message.requestId && self.ps[message.requestId]) {
          emitter.emit(events.sandbox.received);
          self.ps[message.requestId].resolve(message);
          delete self.ps[message.requestId];
        }
        emitter.emit(events.sandbox.file, message);
      });

      this.heartbeat = setInterval(function () {}, 5000);
      if (this.heartbeat.unref) this.heartbeat.unref();

      this._ably.connection.on("disconnected", function () {
        logger.log("Ably disconnected - will auto-reconnect");
      });

      this._ably.connection.on("failed", function () {
        self.apiSocketConnected = false;
        self.instanceSocketConnected = false;
        emitter.emit(events.error.sandbox, "Ably connection failed");
      });
    }

    send(message, timeout) {
      if (timeout === undefined) timeout = 300000;
      if (message.type === "create" || message.type === "direct") {
        return this._sendHttp(message, timeout);
      }
      return this._sendAbly(message, timeout);
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
      }

      var reply = await httpPost(
        this.apiRoot,
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

      if (reply.ably && reply.ably.token) {
        await this._initAbly(reply.ably.token, reply.ably.channels);
        this.instanceSocketConnected = true;

        // Tell the runner to enable debug log forwarding if debug mode is on
        var debugMode =
          process.env.VERBOSE || process.env.DEBUG || process.env.TD_DEBUG;
        if (debugMode && this._ctrlChannel) {
          this._ctrlChannel.publish("control", {
            type: "debug",
            enabled: true,
          });
        }
      }

      if (message.type === "create") {
        const runnerIp = reply.runner && reply.runner.ip;
        const noVncPort = reply.runner && reply.runner.noVncPort;
        const runnerVncUrl = reply.runner && reply.runner.vncUrl;

        logger.log(`Runner claimed — ip=${runnerIp || 'none'}, os=${reply.runner?.os || 'unknown'}, noVncPort=${noVncPort || 'not reported'}, vncUrl=${runnerVncUrl || 'not reported'}`);

        // For cloud Windows sandboxes (no runner in reply), wait for the
        // agent to signal readiness before sending commands.  Without this
        // gate, commands published before the agent subscribes are lost.
        var self = this;
        if (!reply.runner && this._ctrlChannel) {
          logger.log('Waiting for runner agent to signal readiness...');
          var readyTimeout = 120000; // 120s — allows for EC2 boot + agent startup
          await new Promise(function (resolve, reject) {
            var resolved = false;
            function finish(data) {
              if (resolved) return;
              resolved = true;
              clearTimeout(timer);
              self._ctrlChannel.unsubscribe('control', onCtrl);
              // Update runner info if provided
              if (data && data.os) reply.runner = reply.runner || {};
              if (data && data.os && reply.runner) reply.runner.os = data.os;
              if (data && data.ip && reply.runner) reply.runner.ip = data.ip;
              logger.log('Runner agent ready (os=' + ((data && data.os) || 'unknown') + ')');
              resolve();
            }

            var timer = setTimeout(function () {
              if (!resolved) {
                resolved = true;
                self._ctrlChannel.unsubscribe('control', onCtrl);
                reject(new Error('Runner agent did not signal readiness within ' + readyTimeout + 'ms'));
              }
            }, readyTimeout);
            if (timer.unref) timer.unref();

            // Listen for live runner.ready messages
            var onCtrl;
            onCtrl = function (msg) {
              var data = msg.data;
              if (data && data.type === 'runner.ready') {
                finish(data);
              }
            };
            self._ctrlChannel.subscribe('control', onCtrl);

            // Also check channel history in case runner.ready was published
            // before we subscribed (race condition on fast-booting agents).
            try {
              self._ctrlChannel.history({ limit: 50 }, function (err, page) {
                if (err) {
                  logger.warn('History lookup failed (non-fatal): ' + (err.message || err));
                  return;
                }
                if (page && page.items) {
                  for (var i = 0; i < page.items.length; i++) {
                    var item = page.items[i];
                    if (item.name === 'control' && item.data && item.data.type === 'runner.ready') {
                      logger.log('Found runner.ready in channel history');
                      finish(item.data);
                      return;
                    }
                  }
                }
              });
            } catch (histErr) {
              logger.warn('History call threw (non-fatal): ' + (histErr.message || histErr));
            }
          });
        }
        // Prefer the full vncUrl reported by the runner (infrastructure-agnostic).
        // Fall back to constructing from ip + noVncPort for older runners.
        let url;
        if (runnerVncUrl) {
          url = runnerVncUrl;
          logger.log(`Using runner-provided vncUrl: ${url}`);
        } else if (runnerIp && noVncPort) {
          url = `http://${runnerIp}:${noVncPort}/vnc_lite.html`;
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
        return {
          success: true,
          instance: {
            instanceId: reply.sandboxId,
            sandboxId: reply.sandboxId,
            ip: message.ip,
            url: "http://" + message.ip,
          },
        };
      }

      return reply;
    }

    _sendAbly(message, timeout) {
      if (timeout === undefined) timeout = 300000;

      if (
        !this._cmdChannel ||
        !this._ably ||
        this._ably.connection.state !== "connected"
      ) {
        var state = this._ably ? this._ably.connection.state : "unavailable";
        return Promise.reject(
          new Error("Sandbox not connected (state: " + state + ")"),
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

      this._cmdChannel
        .publish("command", message)
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

      var reply = await httpPost(
        this.apiRoot,
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

      var reply = await httpPost(
        this.apiRoot,
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

      if (reply.ably && reply.ably.token) {
        await this._initAbly(reply.ably.token, reply.ably.channels);
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

      // Send end-session control message to runner before disconnecting
      if (this._ctrlChannel && this._ably?.connection?.state === 'connected') {
        try {
          await this._ctrlChannel.publish('control', { type: 'end-session' });
        } catch (e) {
          // Ignore - best effort
        }
      }

      try {
        if (this._cmdChannel) this._cmdChannel.detach().catch(() => {});
        if (this._respChannel) this._respChannel.detach().catch(() => {});
        if (this._ctrlChannel) this._ctrlChannel.detach().catch(() => {});
        if (this._filesChannel) this._filesChannel.detach().catch(() => {});
      } catch (e) {
        /* ignore */
      }

      if (this._ably) {
        try {
          this._ably.close();
        } catch (e) {
          /* ignore */
        }
        this._ably = null;
      }

      this._cmdChannel = null;
      this._respChannel = null;
      this._ctrlChannel = null;
      this._filesChannel = null;
      this._channelNames = null;
      this.apiSocketConnected = false;
      this.instanceSocketConnected = false;
      this.authenticated = false;
      this.instance = null;
      this._lastConnectParams = null;
      this.ps = {};
    }
  }

  return new Sandbox();
};

module.exports = { createSandbox };
