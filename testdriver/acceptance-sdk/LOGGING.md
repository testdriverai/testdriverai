# TestDriver SDK Logging Guide

This guide explains how to see logs while tests run and how to debug SDK behavior.

## Quick Start

### Enable Basic Logging

```bash
# Option 1: Use VERBOSE
VERBOSE=true npm run test:sdk

# Option 2: Use LOGGING
LOGGING=true npm run test:sdk

# Option 3: Set in shell
export VERBOSE=true
npm run test:sdk
```

### Enable Debug Event Logging

See all internal events:

```bash
DEBUG_EVENTS=true npm run test:sdk
```

### Enable All Logging

```bash
VERBOSE=true DEBUG_EVENTS=true npm run test:sdk
```

## Logging Levels

### 1. **Basic Logging** (`VERBOSE=true` or `LOGGING=true`)

Shows:
- ✅ Markdown-formatted AI responses
- 📝 Status messages
- ⚠️  Errors and warnings
- 📊 Command progress

**Example:**
```bash
VERBOSE=true npx vitest run assert.test.mjs
```

**Output:**
```
🔐 Authenticating...
🔌 Connecting to sandbox...
✅ Connected!
- Starting command: assert
- AI analyzing screen...
✅ Assertion passed!
```

### 2. **Event Logging** (`DEBUG_EVENTS=true`)

Shows all internal events:
- 🚀 Command lifecycle (start, success, error)
- 🔌 Sandbox connection events
- 📤📥 SDK API requests/responses
- 🖱️ Mouse and keyboard events
- 📸 Screen capture events

**Example:**
```bash
DEBUG_EVENTS=true npx vitest run type.test.mjs
```

**Output:**
```
[EVENT] command:start { command: 'type', text: 'hello' }
[EVENT] sandbox:sent { type: 'keyboard', keys: [...] }
[EVENT] sandbox:received { status: 'ok' }
✅ Command succeeded
```

### 3. **Combined Logging** (Both flags)

Maximum visibility:

```bash
VERBOSE=true DEBUG_EVENTS=true npm run test:sdk
```

## Logging in Individual Tests

### Enable for Specific Test

```javascript
import { describe, it, beforeAll, afterAll } from 'vitest';
import { createTestClient, setupTest, teardownTest } from './setup/testHelpers.mjs';

describe('My Test', () => {
  let client;

  beforeAll(async () => {
    // Enable logging for this test only
    client = createTestClient({ logging: true });
    await setupTest(client);
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it('should do something', async () => {
    await client.hoverText('Button', null, 'click');
  });
});
```

### Custom Event Listeners

Listen to specific events:

```javascript
import { setupEventLogging } from './setup/testHelpers.mjs';

beforeAll(async () => {
  client = createTestClient();
  
  // Add custom event listeners
  const emitter = client.getEmitter();
  
  emitter.on('command:start', (data) => {
    console.log('Starting command:', data);
  });
  
  emitter.on('command:success', () => {
    console.log('Command completed successfully');
  });
  
  await setupTest(client);
});
```

### Use Built-in Event Logging Helper

```javascript
import { setupEventLogging } from './setup/testHelpers.mjs';

beforeAll(async () => {
  client = createTestClient();
  setupEventLogging(client); // Enable all event logging
  await setupTest(client);
});
```

## Available Events

The SDK emits events through the EventEmitter2 system. Here are the main event categories:

### Command Events
- `command:start` - Command execution begins
- `command:success` - Command completed successfully
- `command:error` - Command failed
- `command:status` - Command status update
- `command:progress` - Command progress update

### Sandbox Events
- `sandbox:connected` - Connected to sandbox
- `sandbox:authenticated` - Authenticated with sandbox
- `sandbox:sent` - Message sent to sandbox
- `sandbox:received` - Message received from sandbox
- `sandbox:error` - Sandbox error occurred
- `sandbox:disconnected` - Disconnected from sandbox

### SDK Events
- `sdk:request` - API request made
- `sdk:response` - API response received
- `sdk:error` - SDK error occurred
- `sdk:progress` - SDK operation progress

### Log Events
- `log:markdown` - Markdown log message
- `log:markdown:start` - Markdown streaming started
- `log:markdown:chunk` - Markdown chunk received
- `log:markdown:end` - Markdown streaming ended
- `log:log` - General log message
- `log:warn` - Warning message
- `log:narration` - AI narration

### Mouse/Keyboard Events
- `mouse-click` - Mouse click performed
- `mouse-move` - Mouse moved
- Screen capture events

### Error Events
- `error:fatal` - Fatal error
- `error:general` - General error
- `error:sdk` - SDK-specific error
- `error:sandbox` - Sandbox-specific error

## Logging Examples

### Example 1: Watch All Events

```javascript
const emitter = client.getEmitter();

emitter.on('**', function(data) {
  console.log(`[${this.event}]`, data);
});
```

### Example 2: Log Only Errors

```javascript
const emitter = client.getEmitter();

emitter.on('error:*', (error) => {
  console.error('Error occurred:', error);
});

emitter.on('command:error', (error) => {
  console.error('Command failed:', error);
});
```

### Example 3: Track Command Execution Time

```javascript
const emitter = client.getEmitter();
const timers = new Map();

emitter.on('command:start', (data) => {
  const id = Date.now();
  timers.set(id, { start: Date.now(), command: data });
});

emitter.on('command:success', (data) => {
  const timer = Array.from(timers.values()).pop();
  if (timer) {
    const duration = Date.now() - timer.start;
    console.log(`✅ Command took ${duration}ms`);
    timers.clear();
  }
});
```

### Example 4: Log Markdown AI Responses

```javascript
const emitter = client.getEmitter();

emitter.on('log:markdown:start', (streamId) => {
  console.log('🤖 AI Response starting...');
});

emitter.on('log:markdown:chunk', (streamId, chunk) => {
  process.stdout.write(chunk);
});

emitter.on('log:markdown:end', (streamId) => {
  console.log('\n✅ AI Response complete');
});
```

## Vitest Reporter Options

### Verbose Reporter

```bash
npx vitest run --reporter=verbose
```

### Dot Reporter (Minimal)

```bash
npx vitest run --reporter=dot
```

### JSON Reporter (for CI)

```bash
npx vitest run --reporter=json --outputFile=test-results.json
```

### Multiple Reporters

```bash
npx vitest run --reporter=verbose --reporter=junit
```

## CI/CD Logging

### GitHub Actions

```yaml
- name: Run SDK Tests
  env:
    TD_API_KEY: ${{ secrets.TD_API_KEY }}
    VERBOSE: true
  run: npm run test:sdk
```

### Local CI Testing

```bash
# Simulate CI environment
CI=true VERBOSE=true npm run test:sdk
```

## Troubleshooting

### No Logs Appearing

1. **Check logging is enabled:**
   ```bash
   echo $VERBOSE
   ```

2. **Verify test helper configuration:**
   ```javascript
   client = createTestClient({ logging: true });
   ```

3. **Check Vitest isn't suppressing output:**
   ```bash
   npx vitest run --reporter=verbose
   ```

### Too Many Logs

1. **Disable event logging:**
   ```bash
   unset DEBUG_EVENTS
   ```

2. **Use selective event listeners:**
   ```javascript
   // Only log errors
   emitter.on('error:*', console.error);
   ```

3. **Filter in tests:**
   ```javascript
   emitter.on('**', function(data) {
     if (!this.event.includes('debug')) {
       console.log(this.event, data);
     }
   });
   ```

### Logs Not Formatted Properly

The SDK uses `marked-terminal` for markdown formatting. If you see raw markdown:

```bash
# Ensure terminal supports ANSI colors
export FORCE_COLOR=1
npm run test:sdk
```

## Performance Impact

Logging has minimal performance impact:

- **Basic logging**: ~1-2% overhead
- **Event logging**: ~3-5% overhead
- **Combined logging**: ~5-10% overhead

For CI/CD, consider:
- Use `VERBOSE=true` for test output
- Avoid `DEBUG_EVENTS=true` unless debugging
- Use JUnit reporter for test results

## Best Practices

1. **Development**: Enable all logging
   ```bash
   export VERBOSE=true
   export DEBUG_EVENTS=true
   ```

2. **CI/CD**: Enable only basic logging
   ```bash
   export VERBOSE=true
   ```

3. **Production**: Disable logging
   ```bash
   unset VERBOSE
   unset DEBUG_EVENTS
   ```

4. **Debugging failures**: Use event logging
   ```bash
   DEBUG_EVENTS=true npx vitest run failing-test.mjs
   ```

5. **Custom logging**: Use emitter events
   ```javascript
   const emitter = client.getEmitter();
   emitter.on('command:start', yourCustomHandler);
   ```
