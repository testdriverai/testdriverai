---
name: testdriver:events
description: Listen to SDK lifecycle events with wildcard support
---
<!-- Generated from events.mdx. DO NOT EDIT. -->

## Overview

TestDriver uses [EventEmitter2](https://github.com/EventEmitter2/EventEmitter2) for its event system. Events use a colon-delimited namespace pattern and support wildcard listeners.

Access the emitter through `testdriver.emitter`:

```javascript
testdriver.emitter.on('command:start', (data) => {
  console.log(`Running: ${data.command}`);
});
```

### Configuration

The internal emitter is created with:

```javascript
new EventEmitter2({
  wildcard: true,
  delimiter: ':',
  maxListeners: 20,
  verboseMemoryLeak: false,
  ignoreErrors: false,
});
```

### Wildcard Listeners

Use `*` to match a single level or `**` to match multiple levels:

```javascript
// Match all log events
testdriver.emitter.on('log:*', (message) => {
  console.log(message);
});

// Match all events in any namespace
testdriver.emitter.on('**', (...args) => {
  console.log('Event:', this.event, args);
});
```

## Event Reference

### Command Events

Emitted during the execution of SDK commands (`click`, `type`, `find`, etc.).

| Event | Payload |
|---|---|
| `command:start` | `{ command, depth, data, timestamp, sourcePosition }` |
| `command:success` | `{ command, depth, data, duration, response, timestamp, sourcePosition }` |
| `command:error` | `{ command, depth, data, error, duration, timestamp, sourcePosition }` |
| `command:status` | `{ command, status: "executing", data, depth, timestamp }` |
| `command:progress` | `{ command, status: "completed", timing, data, depth, timestamp }` |

```javascript
testdriver.emitter.on('command:start', ({ command, data }) => {
  console.log(`Starting ${command}`, data);
});

testdriver.emitter.on('command:error', ({ command, error, duration }) => {
  console.error(`${command} failed after ${duration}ms: ${error}`);
});
```

### Step Events

Emitted for each AI reasoning step within a command.

| Event | Payload |
|---|---|
| `step:start` | `{ stepIndex, prompt, commandCount, timestamp, sourcePosition }` |
| `step:success` | `{ stepIndex, prompt, commandCount, duration, timestamp, sourcePosition }` |
| `step:error` | `{ stepIndex, prompt, error, duration?, timestamp, sourcePosition? }` |

```javascript
testdriver.emitter.on('step:start', ({ stepIndex, prompt }) => {
  console.log(`Step ${stepIndex}: ${prompt}`);
});
```

### Test Events

Emitted when a test file execution starts.

| Event | Payload |
|---|---|
| `test:start` | `{ filePath, timestamp }` |
| `test:success` | *Emitted on test completion* |
| `test:error` | *Emitted on test failure* |

### Log Events

Emitted for all log output from the SDK.

| Event | Payload |
|---|---|
| `log:log` | `(message: string)` — general log message |
| `log:warn` | `(message: string)` — warning message |
| `log:debug` | `(message: string)` — debug output (only when `VERBOSE`/`DEBUG`/`TD_DEBUG` env set) |
| `log:info` | `(message: string)` — informational message |
| `log:error` | `(message: string)` — error message |
| `log:narration` | `(message: string, overwrite?: boolean)` — in-place status line |
| `log:markdown` | `(markdown: string)` — full static markdown content |
| `log:markdown:start` | `(streamId: string)` — begin streaming markdown |
| `log:markdown:chunk` | `(streamId: string, chunk: string)` — incremental chunk |
| `log:markdown:end` | `(streamId: string)` — end streaming markdown |

```javascript
// Capture all logs
testdriver.emitter.on('log:*', function (message) {
  console.log(`[${this.event}]`, message);
});
```

### Screen Capture Events

Emitted during screenshot capture.

| Event | Payload |
|---|---|
| `screen-capture:start` | `{ scale, silent, display }` |
| `screen-capture:end` | `{ scale, silent, display }` |
| `screen-capture:error` | `{ error, scale, silent, display }` |

### Sandbox Events

Emitted for sandbox WebSocket lifecycle and communication.

| Event | Payload |
|---|---|
| `sandbox:connected` | *No payload* — WebSocket connection established |
| `sandbox:authenticated` | `{ traceId }` — authentication successful |
| `sandbox:error` | `(err: Error \| string)` — connection or sandbox error |
| `sandbox:sent` | `(message: object)` — WebSocket message sent |
| `sandbox:received` | *No payload* — successful message reply received |
| `sandbox:progress` | `{ step, message }` — sandbox setup progress |

```javascript
testdriver.emitter.on('sandbox:connected', () => {
  console.log('Connected to sandbox');
});

testdriver.emitter.on('sandbox:progress', ({ step, message }) => {
  console.log(`Sandbox: [${step}] ${message}`);
});
```

### Redraw Events

Emitted during screen stability detection. See [Redraw](/v7/redraw) for more details.

| Event | Payload |
|---|---|
| `redraw:status` | `{ redraw: { enabled, settled, hasChangedFromInitial, consecutiveFramesStable, diffFromInitial, diffFromLast, text }, network: { enabled, settled, rxBytes, txBytes, text }, timeout: { isTimeout, elapsed, max, text } }` |
| `redraw:complete` | `{ screenSettled, hasChangedFromInitial, consecutiveFramesStable, networkSettled, isTimeout, timeElapsed }` |

```javascript
testdriver.emitter.on('redraw:complete', (result) => {
  if (result.isTimeout) {
    console.warn('Redraw timed out after', result.timeElapsed, 'ms');
  }
});
```

### File Events

Emitted during file load/save operations in the agent.

| Event | Payload |
|---|---|
| `file:start` | `{ operation: "load" \| "save" \| "run", filePath, timestamp }` |
| `file:stop` | `{ operation, filePath, duration, success, sourceMap?, reason?, timestamp }` |
| `file:load` | `{ filePath, size, timestamp }` |
| `file:save` | `{ filePath, size, timestamp }` |
| `file:diff` | `{ filePath, diff: { patches, sourceMaps, summary: { additions, deletions, modifications } }, timestamp }` |
| `file:error` | `{ operation, filePath, error, duration?, timestamp }` |

### Error Events

Emitted for errors at various severity levels.

| Event | Payload |
|---|---|
| `error:fatal` | `(error: string \| Error)` — terminates the process |
| `error:general` | `(message: string)` — non-fatal error |
| `error:sandbox` | `(err: Error \| string)` — sandbox/WebSocket error |

```javascript
testdriver.emitter.on('error:*', function (err) {
  console.error(`[${this.event}]`, err);
});
```

### SDK Events

Emitted for API request lifecycle.

| Event | Payload |
|---|---|
| `sdk:request` | `{ path }` — outgoing API request |
| `sdk:response` | `{ path }` — API response received |
| `sdk:retry` | `{ path, attempt, error, delayMs }` — request retry |

### Other Events

| Event | Payload |
|---|---|
| `exit` | `(exitCode: number)` — `0` for success, `1` for failure |
| `status` | `(message: string)` — general status updates |
| `mouse-click` | `{ x, y, button, click, double }` — mouse click performed |
| `terminal:stdout` | Terminal stdout output |
| `terminal:stderr` | Terminal stderr output |

## Practical Examples

### Custom Test Reporter

```javascript
const results = [];

testdriver.emitter.on('command:success', ({ command, duration }) => {
  results.push({ command, duration, status: 'pass' });
});

testdriver.emitter.on('command:error', ({ command, duration, error }) => {
  results.push({ command, duration, status: 'fail', error });
});

// After test completes
afterAll(() => {
  console.table(results);
});
```

### Progress Monitoring

```javascript
testdriver.emitter.on('step:start', ({ stepIndex, prompt }) => {
  process.stdout.write(`\r  Step ${stepIndex}: ${prompt}`);
});

testdriver.emitter.on('command:progress', ({ command, timing }) => {
  process.stdout.write(`\r  ${command} completed in ${timing}ms`);
});
```

### Debug Logging

```javascript
// Log every event (verbose)
testdriver.emitter.on('**', function (...args) {
  console.debug(`[EVENT] ${this.event}`, ...args);
});
```

## Types

```typescript
interface CommandStartEvent {
  command: string;
  depth: number;
  data: Record<string, any>;
  timestamp: number;
  sourcePosition: SourcePosition;
}

interface CommandSuccessEvent {
  command: string;
  depth: number;
  data: Record<string, any>;
  duration: number;
  response: any;
  timestamp: number;
  sourcePosition: SourcePosition;
}

interface CommandErrorEvent {
  command: string;
  depth: number;
  data: Record<string, any>;
  error: string;
  duration: number;
  timestamp: number;
  sourcePosition: SourcePosition;
}

interface StepStartEvent {
  stepIndex: number;
  prompt: string;
  commandCount: number;
  timestamp: number;
  sourcePosition: SourcePosition;
}

interface StepSuccessEvent {
  stepIndex: number;
  prompt: string;
  commandCount: number;
  duration: number;
  timestamp: number;
  sourcePosition: SourcePosition;
}

interface RedrawStatusEvent {
  redraw: {
    enabled: boolean;
    settled: boolean;
    hasChangedFromInitial: boolean;
    consecutiveFramesStable: number;
    diffFromInitial: number;
    diffFromLast: number;
    text: string;
  };
  network: {
    enabled: boolean;
    settled: boolean;
    rxBytes: number;
    txBytes: number;
    text: string;
  };
  timeout: {
    isTimeout: boolean;
    elapsed: number;
    max: number;
    text: string;
  };
}

interface RedrawCompleteEvent {
  screenSettled: boolean;
  hasChangedFromInitial: boolean;
  consecutiveFramesStable: number;
  networkSettled: boolean;
  isTimeout: boolean;
  timeElapsed: number;
}

interface SandboxProgressEvent {
  step: string;
  message: string;
}

interface SourcePosition {
  file: string;
  line: number;
  column: number;
}
```
