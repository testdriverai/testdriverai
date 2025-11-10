# How to See Logs While Tests Run

## Quick Answer

Use the `VERBOSE` or `LOGGING` environment variable:

```bash
VERBOSE=true npm run test:sdk
```

Or for a single test:

```bash
VERBOSE=true npx vitest run testdriver/acceptance-sdk/assert.test.mjs
```

## Logging Options

### 1. Basic Logging (Recommended)
Shows AI responses, status messages, and errors:

```bash
VERBOSE=true npm run test:sdk
```

or

```bash
LOGGING=true npm run test:sdk
```

### 2. Debug Event Logging
Shows ALL internal events (commands, sandbox, API calls):

```bash
DEBUG_EVENTS=true npm run test:sdk
```

### 3. Combined (Maximum Visibility)

```bash
VERBOSE=true DEBUG_EVENTS=true npm run test:sdk
```

## What You'll See

### With `VERBOSE=true`:
```
🔐 Authenticating...
🔌 Connecting to sandbox...
✅ Connected!

    The page shows the TestDriver.ai Sandbox login screen
    with username and password fields visible.

✅ Assertion passed!
```

### With `DEBUG_EVENTS=true`:
```
[EVENT] command:start { command: 'assert', expect: '...' }
[EVENT] sdk:request { method: 'POST', endpoint: '/ai/analyze' }
[EVENT] sdk:response { status: 'ok', result: true }
[EVENT] command:success
```

### With both flags:
You get BOTH outputs combined!

## In Code (Per-Test)

Enable logging for a specific test:

```javascript
beforeAll(async () => {
  client = createTestClient({ logging: true });
  await setupTest(client);
});
```

Or add custom event listeners:

```javascript
beforeAll(async () => {
  client = createTestClient();
  
  const emitter = client.getEmitter();
  emitter.on('command:start', (data) => {
    console.log('Starting:', data);
  });
  
  await setupTest(client);
});
```

## Example Test File

See `example-with-logging.test.mjs` for a complete example with:
- Logging enabled
- Custom event listeners
- Progress messages

Run it with:
```bash
VERBOSE=true npx vitest run testdriver/acceptance-sdk/example-with-logging.test.mjs
```

## Complete Guide

See **LOGGING.md** for:
- All available events
- Advanced logging techniques
- Performance considerations
- CI/CD configuration
- Troubleshooting

## SDK Logger Implementation

The SDK uses the same logger as the CLI (`interfaces/logger.js`):
- Winston for structured logging
- Marked-terminal for markdown formatting
- Event-based architecture
- Automatic censorship of sensitive data

The logger is properly integrated and works via the event emitter system.
