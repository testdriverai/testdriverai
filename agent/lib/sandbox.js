const Ably = require("ably");
const axios = require("axios");
const { events } = require("../events");
const logger = require("./logger");
const { version } = require("../../package.json");
const { withRetry, getSentryTraceHeaders } = require("./sdk");
const sentry = require("../../lib/sentry");

const createSandbox = function (emitter, analytics, sessionInstance) {
  class Sandbox {
    constructor() {
      this._ably = null;
      this._sessionChannel = null;
      this._channelName = null;
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
      this._disconnectedAt = null; // tracks when Realtime connection dropped (for timeout extension on reconnect)

      // Rate limiting state for Ably publishes (Ably limits to 50 msg/sec per connection)
      this._publishLastTime = 0;
      this._publishMinIntervalMs = 25; // 40 msg/sec max, safely under Ably's 50 limit
      this._publishCount = 0;
      this._publishWindowStart = Date.now();
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

    getPublishCount() {
      return this._publishCount;
    }

    async _initAbly(ablyToken, channelName) {
      if (this._ably) {
        try {
          this._ably.close();
        } catch (e) {
          /* ignore */
        }
      }
      this._channelName = channelName;
      var self = this;

      this._ably = new Ably.Realtime({
        authCallback: async function (tokenParams, callback) {
          // On initial connect Ably may supply the token directly; on renewal
          // we must fetch a fresh one from the API (the original token will
          // have expired, causing 40143 token.unrecognized if reused).
          try {
            const response = await axios({
              method: "post",
              url: self.apiRoot + "/api/v7/sandbox/ably-token",
              data: { apiKey: self.apiKey, sandboxId: self._sandboxId },
              headers: { "Content-Type": "application/json" },
              timeout: 15000,
            });
            callback(null, response.data.token);
          } catch (err) {
            logger.warn("[ably] Token renewal failed, falling back to original token: " + (err.message || err));
            callback(null, ablyToken);
          }
        },
        clientId: "sdk-" + this._sandboxId,
        echoMessages: false,              // don't receive our own published messages
        disconnectedRetryTimeout: 5000,   // retry reconnect every 5s (default 15s)
        suspendedRetryTimeout: 15000,     // retry from suspended every 15s (default 30s)
      });

      logger.debug(`[realtime] Connecting as sdk-${this._sandboxId}...`);

      await new Promise(function (resolve, reject) {
        self._ably.connection.on("connected", resolve);
        self._ably.connection.on("failed", function () {
          reject(new Error("Realtime connection failed"));
        });
        setTimeout(function () {
          reject(new Error("Realtime connection timeout"));
        }, 30000);
      });

      this._sessionChannel = this._ably.channels.get(channelName);

      logger.debug(`[realtime] Channel initialized: ${channelName}`);

      // Enter presence on the session channel so the API can count connected SDK clients
      try {
        await this._sessionChannel.presence.enter({
          sandboxId: this._sandboxId,
          connectedAt: Date.now(),
        });
        logger.debug(`[realtime] Entered presence on session channel (sandbox=${this._sandboxId})`);
      } catch (e) {
        // Non-fatal — presence is used for concurrency counting, not critical path
        logger.warn("Failed to enter presence on session channel: " + (e.message || e));
      }

      // Save subscription references for historyBeforeSubscribe() during discontinuity recovery
      this._onResponseMsg = function (msg) {
        var message = msg.data;
        if (!message) return;

        logger.debug(`[realtime] Received response: type=${message.type || 'unknown'} (requestId=${message.requestId || 'none'})`);

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
        // (The runner streams stdout in ~16KB chunks and omits it from the
        // final response to stay under Ably's 64KB message limit.)
        if (message.type === "exec.output") {
          if (message.requestId) {
            if (!self._execBuffers[message.requestId]) {
              self._execBuffers[message.requestId] = '';
            }
            self._execBuffers[message.requestId] += (message.chunk || '');
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
          var pendingIds = Object.keys(self.ps);
          var pendingSummary = pendingIds.length > 0
            ? pendingIds.map(function (rid) {
              var e = self.ps[rid];
              return rid + '(' + (e && e.message ? e.message.type : '?') + ')';
            }).join(', ')
            : 'none';
          logger.debug(
            '[realtime] No pending promise for requestId=' + (message.requestId || 'null') +
            ' | response type=' + (message.type || 'unknown') +
            ' | error=' + (message.error ? (message.errorMessage || 'true') : 'false') +
            ' | currently pending: [' + pendingSummary + ']'
          );
          return;
        }

        if (message.error) {
          var pendingEntry = self.ps[message.requestId];
          var pendingMessage = pendingEntry && pendingEntry.message;
          var pendingAge = pendingEntry && pendingEntry.startTime
            ? ((Date.now() - pendingEntry.startTime) / 1000).toFixed(1) + 's'
            : '?';
          logger.debug(
            '[realtime] Promise REJECTED: requestId=' + message.requestId +
            ' | type=' + (pendingMessage ? pendingMessage.type : 'unknown') +
            ' | age=' + pendingAge +
            ' | error=' + (message.errorMessage || 'Sandbox error')
          );
          if (!pendingMessage || pendingMessage.type !== "output") {
            emitter.emit(events.error.sandbox, message.errorMessage);
          }
          var error = new Error(message.errorMessage || "Sandbox error");
          error.responseData = message;
          delete self._execBuffers[message.requestId];
          pendingEntry.reject(error);
        } else {
          emitter.emit(events.sandbox.received);
          if (self.ps[message.requestId]) {
            var resolveEntry = self.ps[message.requestId];
            var resolveAge = resolveEntry.startTime
              ? ((Date.now() - resolveEntry.startTime) / 1000).toFixed(1) + 's'
              : '?';
            logger.debug(
              '[realtime] Promise RESOLVED: requestId=' + message.requestId +
              ' | type=' + (resolveEntry.message ? resolveEntry.message.type : 'unknown') +
              ' | age=' + resolveAge
            );
            // Unwrap the result from the Ably response envelope
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
      };
      this._responseSubscription = await this._sessionChannel.subscribe("response", this._onResponseMsg);

      this._onFileMsg = function (msg) {
        var message = msg.data;
        if (!message) return;
        logger.debug(`[realtime] Received file: type=${message.type || 'unknown'} (requestId=${message.requestId || 'none'})`);
        if (message.requestId && self.ps[message.requestId]) {
          emitter.emit(events.sandbox.received);
          self.ps[message.requestId].resolve(message);
          delete self.ps[message.requestId];
        }
        emitter.emit(events.sandbox.file, message);
      };
      this._fileSubscription = await this._sessionChannel.subscribe("file", this._onFileMsg);

      this.heartbeat = setInterval(function () { }, 5000);
      if (this.heartbeat.unref) this.heartbeat.unref();

      // ─── Periodic stats logging ────────────────────────────────────────
      this._statsInterval = setInterval(() => {
        const connState = this._ably ? this._ably.connection.state : 'no-client';
        const chState = this._sessionChannel ? this._sessionChannel.state : 'null';
        const pendingIds = Object.keys(this.ps);
        const pending = pendingIds.length;
        logger.debug(`[realtime][stats] connection=${connState} | sandbox=${this._sandboxId} | pending=${pending} | channel=${chState}`);
        if (pending > 0) {
          const now = Date.now();
          for (const rid of pendingIds) {
            const entry = this.ps[rid];
            if (!entry) continue;
            const type = entry.message ? entry.message.type : 'unknown';
            const ageSec = ((now - (entry.startTime || now)) / 1000).toFixed(1);
            logger.debug(`[realtime][stats]   pending: requestId=${rid} | type=${type} | age=${ageSec}s`);
          }
        }
      }, 10000);
      if (this._statsInterval.unref) this._statsInterval.unref();

      this._ably.connection.on("disconnected", function () {
        logger.debug("[realtime] Connection: disconnected - will auto-reconnect");
        self._disconnectedAt = Date.now();
      });

      this._ably.connection.on("connected", function () {
        // Log reconnection so the user knows the blip was recovered
        logger.debug("[realtime] Connection: reconnected");
        // Extend any pending command timeouts by the disconnection duration so
        // commands whose timer was counting down while the connection was down
        // don't get incorrectly timed out.
        if (self._disconnectedAt) {
          var disconnectionDurationMs = Date.now() - self._disconnectedAt;
          self._disconnectedAt = null;
          var pendingIds = Object.keys(self.ps);
          if (pendingIds.length > 0) {
            logger.debug(
              '[realtime] Extending ' + pendingIds.length + ' pending timeout(s) by ' +
              disconnectionDurationMs + 'ms after disconnection'
            );
            for (var i = 0; i < pendingIds.length; i++) {
              var entry = self.ps[pendingIds[i]];
              if (entry && typeof entry.extendTimeout === 'function') {
                entry.extendTimeout(disconnectionDurationMs);
              }
            }
          }
        }
      });

      this._ably.connection.on("suspended", function () {
        logger.debug("[realtime] Connection: suspended - connection lost for extended period, will keep retrying");
      });

      this._ably.connection.on("failed", function () {
        logger.debug("[realtime] Connection: failed");
        self.apiSocketConnected = false;
        self.instanceSocketConnected = false;
        emitter.emit(events.error.sandbox, "Realtime connection failed");
      });

      // ─── Channel discontinuity detection ──────────────────────────────
      // Set up BEFORE subscribing so we catch any continuity loss during
      // the initial attachment. Fires at the channel level, covering all
      // message types (response, file, control).
      this._sessionChannel.on(function (stateChange) {
        var current = stateChange.current;
        var previous = stateChange.previous;
        var reason = stateChange.reason;
        var reasonMsg = reason ? (reason.message || reason.code || String(reason)) : '';

        if (current === 'attached' && stateChange.resumed === false && previous === 'attached') {
          logger.debug('[realtime] Channel DISCONTINUITY detected (resumed=false)' + (reasonMsg ? ' — ' + reasonMsg : ''));
          emitter.emit(events.sandbox.progress, {
            step: 'discontinuity',
            message: 'Recovering missed messages after connection interruption...',
          });
          self._recoverFromDiscontinuity();
        }
      });
    }

    /**
     * Recover missed messages after a channel discontinuity.
     * Uses historyBeforeSubscribe() on each subscription, which guarantees
     * no gap between historical and live messages.  Each recovered message
     * is dispatched through the same handler that processes live messages
     * so that pending promises are resolved/rejected correctly.
     */
    async _recoverFromDiscontinuity() {
      var subs = [
        { name: 'response', sub: this._responseSubscription, handler: this._onResponseMsg },
        { name: 'file', sub: this._fileSubscription, handler: this._onFileMsg },
      ];
      var totalRecovered = 0;
      for (var i = 0; i < subs.length; i++) {
        var entry = subs[i];
        if (!entry.sub) continue;
        try {
          logger.debug('[realtime] Discontinuity recovery: fetching historyBeforeSubscribe for ' + entry.name + '...');
          var page = await entry.sub.historyBeforeSubscribe({ limit: 100 });
          var recovered = 0;
          while (page) {
            // Replay each missed message through the handler so pending
            // promises get resolved instead of timing out.
            for (var j = 0; j < page.items.length; j++) {
              recovered++;
              try {
                if (entry.handler) {
                  logger.debug('[realtime] Replaying recovered ' + entry.name + ' message (requestId=' + (page.items[j].data && page.items[j].data.requestId || 'none') + ')');
                  entry.handler(page.items[j]);
                }
              } catch (replayErr) {
                logger.debug('[realtime] Error replaying recovered message: ' + (replayErr.message || replayErr));
              }
            }
            page = page.hasNext() ? await page.next() : null;
          }
          totalRecovered += recovered;
          logger.debug('[realtime] Discontinuity recovery: replayed ' + recovered + ' ' + entry.name + ' message(s) from gap');
        } catch (err) {
          logger.debug('[realtime] Discontinuity recovery failed for ' + entry.name + ': ' + (err.message || err));
        }
      }
      if (totalRecovered > 0) {
        logger.debug('[realtime] Recovered and replayed ' + totalRecovered + ' message(s) that were missed during connection interruption');
      } else {
        logger.debug('[realtime] Discontinuity recovery: no missed messages found');
      }
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
        apiRoot: this.apiRoot,
      };

      if (message.type === "create") {
        body.os = message.os || this.os || "linux";
        body.resolution = message.resolution;
        body.ci = message.ci;
        if (message.ami) body.ami = message.ami;
        if (message.instanceType) body.instanceType = message.instanceType;
        if (message.e2bTemplateId) body.e2bTemplateId = message.e2bTemplateId;
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

      if (reply.ably && reply.ably.token) {
        await this._initAbly(reply.ably.token, reply.ably.channel);
        this.instanceSocketConnected = true;

        // Tell the runner to enable debug log forwarding if debug mode is on
        var debugMode =
          process.env.VERBOSE || process.env.TD_DEBUG;
        if (debugMode && this._sessionChannel) {
          this._sessionChannel.publish("control", {
            type: "debug",
            enabled: true,
          });
        }
      }

      // ─── Handle pending slot claim (trigger.dev waitpoint flow) ────
      // The API returned early with status: 'pending'. The SDK has now
      // connected to Ably and entered presence (done in _initAbly above).
      // Wait for the claim-slot task to publish slot-approved or slot-denied
      // on the control channel, then re-call authenticate with slotApproved.
      // On slot-denied, we poll forever (re-calling authenticate every 10s)
      // until a slot opens, matching _httpPostWithConcurrencyRetry behavior.
      var concurrencyRetryInterval = 10000;
      var slotPollStart = Date.now();
      while (reply.status === 'pending') {
        logger.log('Slot claim pending — waiting for approval via Ably...');

        var self = this;
        var slotResolved = false;
        var slotResolve, slotReject;
        var slotDecisionPromise = new Promise(function (resolve, reject) {
          slotResolve = resolve;
          slotReject = reject;
        });

        var slotTimeout = setTimeout(function () {
          if (slotResolved) return;
          slotResolved = true;
          try { self._sessionChannel.unsubscribe('control', onSlotControl); } catch (_) {}
          slotReject(new Error('Slot claim timed out waiting for approval'));
        }, 60000); // 60s timeout
        if (slotTimeout.unref) slotTimeout.unref();

        function onSlotControl(msg) {
          var data = msg.data;
          if (!data) return;
          if (data.type === 'slot-approved') {
            if (slotResolved) return;
            slotResolved = true;
            clearTimeout(slotTimeout);
            try { self._sessionChannel.unsubscribe('control', onSlotControl); } catch (_) {}
            slotResolve({ approved: true, data: data });
          } else if (data.type === 'slot-denied') {
            if (slotResolved) return;
            slotResolved = true;
            clearTimeout(slotTimeout);
            try { self._sessionChannel.unsubscribe('control', onSlotControl); } catch (_) {}
            slotResolve({ approved: false, data: data });
          }
        }

        // Subscribe FIRST, then check history to close the race window
        // between presence enter (done in _initAbly) and this subscription.
        // The claim-slot task fires in response to presence enter, so the
        // decision may already be published by the time we get here.
        var slotControlSub = await self._sessionChannel.subscribe('control', onSlotControl);

        // Check for decisions published before this subscription was active
        if (!slotResolved && slotControlSub) {
          try {
            var histPage = await slotControlSub.historyBeforeSubscribe({ limit: 10 });
            while (histPage && !slotResolved) {
              for (var hi = 0; hi < histPage.items.length; hi++) {
                onSlotControl(histPage.items[hi]);
                if (slotResolved) break;
              }
              histPage = (!slotResolved && histPage.hasNext()) ? await histPage.next() : null;
            }
          } catch (histErr) {
            logger.warn('[slots] Failed to check history for slot decision: ' + (histErr.message || histErr));
          }
        }

        var slotDecision = await slotDecisionPromise;

        if (!slotDecision.approved) {
          // Slot denied — disconnect Ably and re-try the full authenticate
          // flow after a delay, polling forever until a slot opens.
          var elapsed = Date.now() - slotPollStart;
          logger.log(
            'Slot denied: ' + (slotDecision.data.message || 'concurrency limit reached') +
            ' — waiting ' + (concurrencyRetryInterval / 1000) + 's before retrying' +
            ' (' + Math.round(elapsed / 1000) + 's elapsed)...'
          );
          logger.log('Upgrade for more slots → https://console.testdriver.ai/checkout/team');
          try {
            if (this._ably) this._ably.close();
            this._ably = null;
            this._sessionChannel = null;
          } catch (_) {}

          await new Promise(function (resolve) {
            var t = setTimeout(resolve, concurrencyRetryInterval);
            if (t.unref) t.unref();
          });

          // Re-call authenticate — this goes through _httpPostWithConcurrencyRetry
          // so transient HTTP errors are also handled. The new reply will either
          // be 'pending' again (loop continues) or succeed directly.
          reply = await this._httpPostWithConcurrencyRetry(
            "/api/v7/sandbox/authenticate",
            body,
            timeout,
          );

          if (!reply.success && reply.status !== 'pending') {
            var retryErr = new Error(
              reply.errorMessage || "Failed to allocate sandbox",
            );
            retryErr.responseData = reply;
            throw retryErr;
          }

          // Re-init Ably if we got a new pending reply with fresh credentials
          if (reply.status === 'pending' && reply.ably && reply.ably.token) {
            this._sandboxId = reply.sandboxId;
            this._teamId = reply.teamId;
            await this._initAbly(reply.ably.token, reply.ably.channel);
            this.instanceSocketConnected = true;
          }

          continue; // loop back to wait for the next slot decision
        }

        logger.log('Slot approved — provisioning sandbox...');

        // Re-call authenticate with slotApproved flag to trigger provisioning
        // Keep the same sandboxId so the Ably channel stays valid
        var provisionBody = {
          apiKey: this.apiKey,
          version: version,
          os: message.os || this.os || 'linux',
          session: sessionId,
          apiRoot: this.apiRoot,
          sandboxId: this._sandboxId,
          slotApproved: true,
        };
        if (message.resolution) provisionBody.resolution = message.resolution;
        if (message.ci) provisionBody.ci = message.ci;
        if (message.ami) provisionBody.ami = message.ami;
        if (message.instanceType) provisionBody.instanceType = message.instanceType;
        if (message.e2bTemplateId) provisionBody.e2bTemplateId = message.e2bTemplateId;
        if (message.keepAlive !== undefined) provisionBody.keepAlive = message.keepAlive;

        reply = await this._httpPostWithConcurrencyRetry(
          "/api/v7/sandbox/authenticate",
          provisionBody,
          timeout,
        );

        if (!reply.success) {
          var provisionErr = new Error(
            reply.errorMessage || "Failed to provision sandbox after approval",
          );
          provisionErr.responseData = reply;
          throw provisionErr;
        }

        break; // slot approved and provisioned — exit the while loop
      }

      if (message.type === "create") {
        // E2B (Linux) sandboxes return a url directly.
        // We still need to wait for runner.ready since sandbox-agent.js runs inside E2B.
        const isE2B = !!reply.url;
        
        const runnerIp = reply.runner && reply.runner.ip;
        const noVncPort = reply.runner && reply.runner.noVncPort;
        const runnerVncUrl = reply.runner && reply.runner.vncUrl;

        // Log image version info (AMI for Windows, E2B template for Linux)
        if (reply.imageVersion) {
          if (isE2B) {
            logger.log('E2B image version: v' + reply.imageVersion + (reply.e2bTemplateId ? ' (template: ' + reply.e2bTemplateId + ')' : ''));
          } else {
            logger.log('AMI image version: v' + reply.imageVersion + (reply.amiId ? ' (ami: ' + reply.amiId + ')' : ''));
          }
        }

        if (!isE2B) {
          logger.log(`Runner claimed — ip=${runnerIp || 'none'}, os=${reply.runner?.os || 'unknown'}, noVncPort=${noVncPort || 'not reported'}, vncUrl=${runnerVncUrl || 'not reported'}`);
        }

        // Wait for the runner agent to signal readiness before sending commands.
        // Without this gate, commands published before the agent subscribes are lost.
        // This applies to:
        //   - E2B Linux sandboxes (native runner agent via sandbox-agent.js)
        //   - Windows EC2 sandboxes without presence runners
        // For presence-based Windows runners (reply.runner already set), the runner
        // is already listening so we can skip the wait.
        var self = this;
        const needsReadyWait = this._sessionChannel && (isE2B || !reply.runner);
        if (needsReadyWait) {
          logger.log('Waiting for runner agent to signal readiness...');
          // E2B (Linux) sandboxes need extra time: S3 upload + npm install can add 60-120s on top of sandbox boot
          // EC2 (Windows) cold starts can be slow due to AV scanning and native module loading
          var readyTimeout = isE2B ? 300000 : 180000; // 5 min for E2B (S3+npm), 3 min for EC2
          await new Promise(function (resolve, reject) {
            var resolved = false;
            var waitStart = Date.now();
            function finish(data) {
              if (resolved) return;
              resolved = true;
              clearTimeout(timer);
              clearInterval(progressTimer);
              self._sessionChannel.unsubscribe('control', onCtrl);
              // Update runner info if provided
              if (data && data.os) reply.runner = reply.runner || {};
              if (data && data.os && reply.runner) reply.runner.os = data.os;
              if (data && data.ip && reply.runner) reply.runner.ip = data.ip;
              if (data && data.runnerVersion && reply.runner) reply.runner.version = data.runnerVersion;
              // Persist version metadata for test result reporting
              self._runnerVersionBefore = reply.imageVersion || null;
              self._runnerVersionAfter = (data && data.runnerVersion) || reply.imageVersion || null;
              self._wasUpdated = !!(data && data.runnerVersion && reply.imageVersion && data.runnerVersion !== reply.imageVersion);
              logger.log('Runner agent ready (os=' + ((data && data.os) || 'unknown') + ', runner v' + ((data && data.runnerVersion) || 'unknown') + ')');
              // Show upgrade info: if the runner's npm version differs from the baked image version,
              // the runner was upgraded during provisioning.
              var runnerVer = data && data.runnerVersion;
              var imageVer = reply.imageVersion;
              if (runnerVer && imageVer && runnerVer !== imageVer) {
                logger.log('Runner upgraded during provisioning: v' + imageVer + ' \u2192 v' + runnerVer);
              }
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
                clearInterval(progressTimer);
                self._sessionChannel.unsubscribe('control', onCtrl);
                var err = new Error('Runner agent did not signal readiness within ' + readyTimeout + 'ms');
                sentry.captureException(err, {
                  tags: { phase: 'runner_ready', connection_type: 'create' },
                  extra: { readyTimeout: readyTimeout, sandboxId: reply.sandboxId },
                });
                reject(err);
              }
            }, readyTimeout);
            if (timer.unref) timer.unref();

            // Log progress every 15s so the user knows we're still waiting
            var progressTimer = setInterval(function () {
              if (resolved) return;
              var elapsed = Math.round((Date.now() - waitStart) / 1000);
              logger.log('Still waiting for runner agent... (' + elapsed + 's elapsed, timeout=' + Math.round(readyTimeout / 1000) + 's)');
            }, 15000);

            // Listen for live runner.ready messages
            var onCtrl;
            onCtrl = function (msg) {
              var data = msg.data;
              if (data && data.type === 'runner.ready') {
                finish(data);
              }
            };
            self._sessionChannel.subscribe('control', onCtrl);

            // Also check channel history in case runner.ready was published
            // before we subscribed (race condition on fast-booting agents).
            try {
              self._sessionChannel.history({ limit: 50 }, function (err, page) {
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
        // For E2B sandboxes, use the url from the API reply.
        // Fall back to constructing from ip + noVncPort for older runners.
        let url;
        if (isE2B && reply.url) {
          url = reply.url;
          logger.log(`E2B sandbox ready — url=${url}`);
        } else if (runnerVncUrl) {
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
            // Extra metadata for test result reporting
            amiId: reply.amiId || null,
            e2bTemplateId: reply.e2bTemplateId || null,
            imageVersion: reply.imageVersion || null,
            runnerVersionBefore: this._runnerVersionBefore || reply.imageVersion || null,
            runnerVersionAfter: this._runnerVersionAfter || reply.runner?.version || null,
            wasUpdated: this._wasUpdated || false,
            vncUrl: url || null,
            channelName: this._channelName || null,
          },
        };
      }

      if (message.type === "direct") {
        // If the API returned provisioning commands and we have an instanceId,
        // send them to the instance via SSM (client-side).
        // This runs from the user's infrastructure where AWS permissions exist,
        // rather than from the API server.
        // NOTE: For direct connections, the user MUST provide the AWS instanceId
        // because the API only knows the sandboxId, not the actual EC2 instance ID.
        var instanceId = message.instanceId;
        if (instanceId && reply.provisionCommands) {
          // New path: API generated full provisioning commands (runner install + config + start)
          logger.log('Provisioning instance ' + instanceId + ' via SSM (API-generated commands)...');
          await this._sendSSMCommands(instanceId, reply.provisionCommands);
          logger.log('Instance provisioned successfully.');
        } else if (reply.agentConfig && instanceId) {
          // Fallback: older API that only returns agentConfig (config-only, no runner install)
          logger.log('Provisioning agent config to instance ' + instanceId + ' via SSM (legacy)...');
          await this._provisionAgentConfig(instanceId, reply.agentConfig);
          logger.log('Agent config provisioned successfully.');
        } else if ((reply.agentConfig || reply.provisionCommands) && !instanceId) {
          logger.log('Warning: agentConfig/provisionCommands returned but no instanceId provided - cannot provision via SSM');
        }

        // If the API returned agent credentials (reply.agent present),
        // wait for the runner agent to signal readiness before sending commands.
        // Without this gate, commands published before the agent subscribes are lost.
        var self = this;
        if (reply.agent && this._sessionChannel) {
          logger.log('Waiting for runner agent to signal readiness (direct connection)...');
          var readyTimeout = 60000 * 5;
          await new Promise(function (resolve, reject) {
            var resolved = false;
            var waitStart = Date.now();
            function finish(data) {
              if (resolved) return;
              resolved = true;
              clearTimeout(timer);
              clearInterval(progressTimer);
              self._sessionChannel.unsubscribe('control', onCtrl);
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
                clearInterval(progressTimer);
                self._sessionChannel.unsubscribe('control', onCtrl);
                var err = new Error('Runner agent did not signal readiness within ' + readyTimeout + 'ms (direct connection)');
                sentry.captureException(err, {
                  tags: { phase: 'runner_ready', connection_type: 'direct' },
                  extra: { readyTimeout: readyTimeout, sandboxId: reply.sandboxId, instanceId: message.instanceId },
                });
                reject(err);
              }
            }, readyTimeout);
            if (timer.unref) timer.unref();

            // Log progress every 15s so the user knows we're still waiting
            var progressTimer = setInterval(function () {
              if (resolved) return;
              var elapsed = Math.round((Date.now() - waitStart) / 1000);
              logger.log('Still waiting for runner agent... (' + elapsed + 's elapsed, timeout=' + Math.round(readyTimeout / 1000) + 's)');
            }, 15000);

            // Listen for live runner.ready messages
            var onCtrl;
            onCtrl = function (msg) {
              var data = msg.data;
              if (data && data.type === 'runner.ready') {
                finish(data);
              }
            };
            self._sessionChannel.subscribe('control', onCtrl);

            // Also check channel history in case runner.ready was published
            // before we subscribed (race condition on fast-booting agents).
            try {
              self._sessionChannel.history({ limit: 50 }, function (err, page) {
                if (err) {
                  logger.warn('History lookup failed (non-fatal): ' + (err.message || err));
                  return;
                }
                if (page && page.items) {
                  for (var i = 0; i < page.items.length; i++) {
                    var item = page.items[i];
                    if (item.name === 'control' && item.data && item.data.type === 'runner.ready') {
                      logger.log('Found runner.ready in channel history (direct)');
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

    _sendAbly(message, timeout) {
      if (timeout === undefined) timeout = 300000;

      if (!this._sessionChannel || !this._ably) {
        return Promise.reject(
          new Error("Sandbox not connected (no Ably client)"),
        );
      }

      // If temporarily disconnected, wait up to 30s for reconnection
      // instead of failing immediately (dashcam uploads can cause brief blips)
      var self = this;
      var connState = this._ably.connection.state;
      if (connState !== "connected") {
        if (connState === "disconnected" || connState === "connecting" || connState === "suspended") {
          logger.log("Ably is " + connState + ", waiting for reconnect before sending...");
          var waitForConnect = new Promise(function (resolve, reject) {
            var timer = setTimeout(function () {
              self._ably.connection.off("connected", onConnected);
              self._ably.connection.off("failed", onFailed);
              reject(new Error("Sandbox not connected after waiting 30s (state: " + self._ably.connection.state + ")"));
            }, 30000);
            if (timer.unref) timer.unref();
            function onConnected() {
              clearTimeout(timer);
              self._ably.connection.off("failed", onFailed);
              resolve();
            }
            function onFailed() {
              clearTimeout(timer);
              self._ably.connection.off("connected", onConnected);
              reject(new Error("Realtime connection failed while waiting to send"));
            }
            self._ably.connection.once("connected", onConnected);
            self._ably.connection.once("failed", onFailed);
          });
          return waitForConnect.then(function () {
            return self._sendAbly(message, timeout);
          });
        }
        return Promise.reject(
          new Error("Sandbox not connected (state: " + connState + ")"),
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

      // timeoutId and timeoutExpiresAt are declared as vars so they can be
      // updated by extendTimeout() (closure mutation).
      var timeoutId;
      var timeoutExpiresAt;

      var timeoutFn = function () {
        if (self.ps[requestId]) {
          var pendingIds = Object.keys(self.ps);
          var pendingSummary = pendingIds.map(function (rid) {
            var e = self.ps[rid];
            var age = e && e.startTime ? ((Date.now() - e.startTime) / 1000).toFixed(1) + 's' : '?';
            return rid + '(' + (e && e.message ? e.message.type : '?') + ', ' + age + ')';
          }).join(', ');
          logger.error(
            '[realtime] Promise TIMEOUT: requestId=' + requestId +
            ' | type=' + message.type +
            ' | timeout=' + timeout + 'ms' +
            ' | all pending: [' + pendingSummary + ']'
          );
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
      };

      timeoutId = setTimeout(timeoutFn, timeout);
      timeoutExpiresAt = Date.now() + timeout;
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
        /**
         * Extend the pending timeout by disconnectionDurationMs — called on Ably reconnect
         * to compensate for time spent disconnected.
         */
        extendTimeout: function (disconnectionDurationMs) {
          clearTimeout(timeoutId);
          // Clamp remaining to 0 so a command whose timer expired during the
          // outage still gets the full disconnection duration as its new budget.
          var remaining = Math.max(0, timeoutExpiresAt - Date.now());
          // Minimum 5s remaining after extension to allow the response to arrive.
          var MIN_REMAINING_MS = 5000;
          var newRemaining = Math.max(remaining + disconnectionDurationMs, MIN_REMAINING_MS);
          timeoutExpiresAt = Date.now() + newRemaining;
          timeoutId = setTimeout(timeoutFn, newRemaining);
          if (timeoutId.unref) timeoutId.unref();
          logger.log(
            '[realtime] Extended timeout for requestId=' + requestId +
            ' by ' + disconnectionDurationMs + 'ms (new remaining: ' + Math.round(newRemaining / 1000) + 's)'
          );
        },
        message: message,
        startTime: Date.now(),
      };

      if (message.type === "output") {
        p.catch(function () { });
      }

      this._throttledPublish(this._sessionChannel, "command", message)
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

    /**
     * Throttled publish to stay under Ably's 50 msg/sec per-connection limit.
     * Also tracks and logs the current publish rate for debugging.
     * @param {Object} channel - Ably channel to publish on
     * @param {string} eventName - Event name for the publish
     * @param {Object} message - Message payload
     * @returns {Promise} - Resolves when publish completes
     */
    async _throttledPublish(channel, eventName, message) {
      var self = this;
      var now = Date.now();

      // Rate limiting: wait if too soon since last publish
      var elapsed = now - this._publishLastTime;
      if (elapsed < this._publishMinIntervalMs) {
        var waitMs = this._publishMinIntervalMs - elapsed;
        await new Promise(function (resolve) {
          var timer = setTimeout(resolve, waitMs);
          if (timer.unref) timer.unref();
        });
      }
      this._publishLastTime = Date.now();

      // Metrics: track messages per second
      this._publishCount++;
      var windowElapsed = Date.now() - this._publishWindowStart;
      if (windowElapsed >= 1000) {
        var rate = (this._publishCount / windowElapsed) * 1000;
        var rateStr = rate.toFixed(1);

        // Log rate - warning if approaching limit, debug otherwise
        if (rate > 45) {
          logger.warn("Ably publish rate: " + rateStr + " msg/sec (approaching 50/sec limit)");
        } else if (process.env.VERBOSE || process.env.TD_DEBUG) {
          logger.log("Ably publish rate: " + rateStr + " msg/sec");
        }

        // Reset window
        this._publishCount = 0;
        this._publishWindowStart = Date.now();
      }

      return channel.publish(eventName, message).then(function () {
        logger.debug(`[realtime] Published: channel=${channel.name.split(':').pop()}, event=${eventName}, type=${message.type || 'unknown'} (requestId=${message.requestId || 'none'})`);
      });
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

      if (reply.ably && reply.ably.token) {
        await this._initAbly(reply.ably.token, reply.ably.channel);
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
      if (this._statsInterval) {
        clearInterval(this._statsInterval);
        this._statsInterval = null;
      }

      // Send end-session control message to runner before disconnecting
      if (this._sessionChannel && this._ably?.connection?.state === 'connected') {
        try {
          logger.debug('[realtime] Publishing control: type=end-session');
          await this._sessionChannel.publish('control', { type: 'end-session' });
        } catch (e) {
          // Ignore - best effort
        }
      }

      // Leave presence on session channel
      if (this._sessionChannel) {
        try {
          logger.debug('[realtime] Leaving presence on session channel');
          await this._sessionChannel.presence.leave();
        } catch (e) {
          // ignore - best effort, Ably will auto-leave on disconnect
        }
      }

      try {
        logger.debug('[realtime] Detaching session channel');
        if (this._sessionChannel) {
          await this._sessionChannel.detach();
        }
      } catch (e) {
        /* ignore */
      }

      if (this._ably) {
        try {
          logger.debug('[realtime] Closing Realtime connection');
          this._ably.close();
        } catch (e) {
          /* ignore */
        }
        this._ably = null;
      }

      this._sessionChannel = null;
      this._channelName = null;
      this.apiSocketConnected = false;
      this.instanceSocketConnected = false;
      this.authenticated = false;
      this.instance = null;
      this._lastConnectParams = null;
      this.ps = {};
    }

    /**
     * Send pre-generated PowerShell commands to an EC2 instance via AWS SSM.
     * The commands are generated by the API (sdk/agent/lib/provision-commands.js)
     * so provisioning logic lives in one place.
     */
    async _sendSSMCommands(instanceId, commands) {
      const { execSync } = require('child_process');
      const { writeFileSync, unlinkSync } = require('fs');
      const { join } = require('path');
      const { tmpdir } = require('os');
      const { randomUUID } = require('crypto');

      const region = process.env.AWS_REGION || 'us-east-2';
      const paramsJson = JSON.stringify({ commands: commands });
      const tmpFile = join(tmpdir(), 'td-provision-' + randomUUID() + '.json');
      writeFileSync(tmpFile, paramsJson);

      try {
        const output = execSync(
          'aws ssm send-command --region "' + region + '" --instance-ids "' + instanceId + '" ' +
          '--document-name "AWS-RunPowerShellScript" ' +
          '--parameters file://' + tmpFile + ' --output json',
          { encoding: 'utf-8', timeout: 30000 }
        );
        var cmdId = JSON.parse(output).Command.CommandId;
        logger.log('SSM command sent: ' + cmdId);

        // Wait for the command to complete
        execSync(
          'aws ssm wait command-executed --region "' + region + '" ' +
          '--command-id "' + cmdId + '" --instance-id "' + instanceId + '"',
          { encoding: 'utf-8', timeout: 300000 } // 5 min — runner install can take a while
        );

        // Get the command output for debugging
        try {
          var invocationOutput = execSync(
            'aws ssm get-command-invocation --region "' + region + '" ' +
            '--command-id "' + cmdId + '" --instance-id "' + instanceId + '" --output json',
            { encoding: 'utf-8', timeout: 30000 }
          );
          var invocation = JSON.parse(invocationOutput);
          if (invocation.StandardOutputContent) {
            logger.log('SSM output:\n' + invocation.StandardOutputContent);
          }
          if (invocation.StandardErrorContent) {
            logger.warn('SSM errors:\n' + invocation.StandardErrorContent);
          }
        } catch (e) {
          logger.warn('Could not retrieve SSM command output: ' + e.message);
        }
      } finally {
        try { unlinkSync(tmpFile); } catch (e) { /* ignore */ }
      }
    }

    /**
     * Write the agent config JSON to an EC2 instance via AWS SSM.
     * Runs client-side so the API doesn't need AWS permissions on user infra.
     * LEGACY: Used when connecting to an API that doesn't return provisionCommands.
     */
    async _provisionAgentConfig(instanceId, agentConfig) {
      const { execSync } = require('child_process');
      const { writeFileSync, unlinkSync } = require('fs');
      const { join } = require('path');
      const { tmpdir } = require('os');

      const configJson = JSON.stringify(agentConfig);
      const region = process.env.AWS_REGION || 'us-east-2';

      // Write SSM parameters to a temp file to avoid shell quoting issues
      // Log key config details for debugging
      logger.log('Agent config being provisioned:');
      logger.log('  sandboxId: ' + agentConfig.sandboxId);
      logger.log('  apiRoot: ' + agentConfig.apiRoot);
      logger.log('  channel: ' + (agentConfig.ably?.channel || 'N/A'));
      logger.log('  token length: ' + (agentConfig.ably?.token ? JSON.stringify(agentConfig.ably.token).length : 0));

      const paramsJson = JSON.stringify({
        commands: [
          // Debug: show existing state
          "Write-Host '=== Checking existing state ==='",
          "$task = Get-ScheduledTask -TaskName RunTestDriverAgent -ErrorAction SilentlyContinue",
          "if ($task) { Write-Host \"Task exists, state: $($task.State)\" } else { Write-Host 'Task does NOT exist!' }",
          "if (Test-Path 'C:\\Windows\\Temp\\testdriver-agent.json') { Write-Host 'Old config:'; Get-Content 'C:\\Windows\\Temp\\testdriver-agent.json' | Write-Host } else { Write-Host 'Config file does NOT exist yet' }",
          // Stop any running runner
          "Write-Host '=== Stopping runner ==='",
          "Stop-Process -Name node -Force -ErrorAction SilentlyContinue",
          "Stop-ScheduledTask -TaskName RunTestDriverAgent -ErrorAction SilentlyContinue",
          // Write config
          "Write-Host '=== Writing config ==='",
          "$config = '" + configJson.replace(/'/g, "''") + "'",
          "[System.IO.File]::WriteAllText('C:\\Windows\\Temp\\testdriver-agent.json', $config)",
          "Write-Host 'Config written for sandbox " + agentConfig.sandboxId + "'",
          // Show what was written (redact token)
          "Write-Host '=== New config (token redacted) ==='",
          "$cfg = Get-Content 'C:\\Windows\\Temp\\testdriver-agent.json' | ConvertFrom-Json",
          "Write-Host \"sandboxId: $($cfg.sandboxId)\"",
          "Write-Host \"apiRoot: $($cfg.apiRoot)\"",
          "Write-Host \"channel: $($cfg.ably.channel)\"",
          "Write-Host \"token type: $($cfg.ably.token.GetType().Name)\"",
          // Start the runner
          "Write-Host '=== Starting runner ==='",
          "Start-Sleep -Seconds 1",
          "Start-ScheduledTask -TaskName RunTestDriverAgent -ErrorAction Stop",
          "$task = Get-ScheduledTask -TaskName RunTestDriverAgent",
          "Write-Host \"Task state after start: $($task.State)\"",
          // Check if node process started
          "Start-Sleep -Seconds 3",
          "Write-Host '=== Checking runner process ==='",
          "$procs = Get-Process -Name node -ErrorAction SilentlyContinue",
          "if ($procs) { Write-Host \"Node processes: $($procs.Count)\"; $procs | ForEach-Object { Write-Host \"  PID: $($_.Id), StartTime: $($_.StartTime)\" } } else { Write-Host 'No node process found!' }",
          // Check runner logs
          "Write-Host '=== Runner log (last 30 lines) ==='",
          "if (Test-Path 'C:\\testdriver\\logs\\sandbox-agent.log') { Get-Content 'C:\\testdriver\\logs\\sandbox-agent.log' -Tail 30 | Write-Host } else { Write-Host 'No log file found' }",
          "Write-Host '=== Done ==='",
        ],
      });
      const { randomUUID } = require('crypto');
      const tmpFile = join(tmpdir(), 'td-provision-' + randomUUID() + '.json');
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

        // Get the command output for debugging
        try {
          const invocationOutput = execSync(
            'aws ssm get-command-invocation --region "' + region + '" ' +
            '--command-id "' + cmdId + '" --instance-id "' + instanceId + '" --output json',
            { encoding: 'utf-8', timeout: 30000 }
          );
          const invocation = JSON.parse(invocationOutput);
          if (invocation.StandardOutputContent) {
            logger.log('SSM output:\n' + invocation.StandardOutputContent);
          }
          if (invocation.StandardErrorContent) {
            logger.warn('SSM errors:\n' + invocation.StandardErrorContent);
          }
        } catch (e) {
          logger.warn('Could not retrieve SSM command output: ' + e.message);
        }
      } finally {
        try { unlinkSync(tmpFile); } catch (e) { /* ignore */ }
      }
    }
  }

  return new Sandbox();
};

module.exports = { createSandbox };
