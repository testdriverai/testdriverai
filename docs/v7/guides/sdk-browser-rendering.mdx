# SDK Browser Rendering Feature

## Overview

The TestDriver SDK now supports automatic browser rendering of the sandbox environment, matching the behavior of the existing agent CLI. When connecting to a sandbox, the SDK will automatically open a browser window showing the live VNC session, allowing you to watch test execution in real-time.

## Changes Made

### 1. SDK Core (`sdk.js`)

#### Added Dependencies
- Imported `createDebuggerProcess` from `./agent/lib/debugger.js` to enable the debugger server

#### New Instance Variables
- `debuggerProcess`: Reference to the debugger server process
- `debuggerUrl`: URL of the debugger web interface

#### Enhanced `connect()` Method
- Automatically starts the debugger server when connecting (unless in headless mode)
- Calls `_renderSandbox()` after successful connection to open the browser window
- Supports new `headless` option to disable browser rendering

#### New Methods

**`_renderSandbox(instance)`**
- Constructs the VNC URL from the sandbox instance details
- Creates encoded data payload for the debugger
- Emits the `show-window` event with the debugger URL

**`_openBrowser(url)`**
- Uses the `open` npm package to launch the default browser
- Handles errors gracefully with fallback to manual URL copy
- Uses dynamic import for ES module compatibility

#### Enhanced `_setupLogging()` Method
- Added event listener for `show-window` events
- Automatically opens browser when event is emitted
- Respects CI mode (prints view-only URL instead of opening browser)

### 2. Documentation Updates

#### SDK README (`SDK_README.md`)
- Updated `connect()` method documentation
- Added `headless` parameter description
- Added note about automatic browser rendering behavior
- Provided examples for both headless and non-headless modes

### 3. Examples

#### `examples/sdk-with-browser.js`
- Demonstrates default behavior with browser rendering
- Shows how to use the SDK with visual feedback
- Includes detailed console output explaining what's happening

#### `examples/sdk-headless.js`
- Demonstrates headless mode for CI/CD environments
- Shows how to disable browser rendering
- Useful for automated testing scenarios

### 4. Tests

#### `testdriver/acceptance-sdk/sandbox-render.test.mjs`
- Verifies that the `show-window` event is emitted
- Tests basic interaction with the rendered sandbox
- Includes timeout handling for sandbox creation

## How It Works

1. **Connection Phase**
   - When `connect()` is called without `headless: true`
   - The debugger server is started on port 3000 (by default)
   - The sandbox is created/connected as usual

2. **Rendering Phase**
   - After successful connection, `_renderSandbox()` is called
   - It constructs the VNC URL: `http://{instance.ip}:{vncPort}/vnc_lite.html?token=V3b8wG9`
   - Creates data payload with resolution, URL, and token
   - Builds debugger URL: `{debuggerUrl}?data={encodedData}`

3. **Browser Opening**
   - The `show-window` event is emitted with the debugger URL
   - The event listener in `_setupLogging()` catches it
   - The `_openBrowser()` method is called
   - Default browser opens to the debugger interface
   - User can watch live test execution

## Usage Examples

### Default Behavior (Browser Opens)

```javascript
const TestDriver = require('testdriverai');

const client = new TestDriver(process.env.TD_API_KEY, {
  logging: true
});

await client.auth();
await client.connect(); // Browser opens automatically

await client.hoverText('Submit');
await client.click();
```

### Headless Mode (No Browser)

```javascript
const TestDriver = require('testdriverai');

const client = new TestDriver(process.env.TD_API_KEY, {
  logging: true
});

await client.auth();
await client.connect({ headless: true }); // No browser

await client.hoverText('Submit');
await client.click();
```

### CI/CD Mode

When `CI` environment variable is set or `config.CI` is true, the SDK will:
- Print the view-only URL instead of opening a browser
- Allow monitoring without interrupting the test flow

## Benefits

1. **Visual Feedback**: Developers can watch tests execute in real-time
2. **Debugging**: Easier to understand test failures by seeing what's happening
3. **Consistency**: Matches the behavior of the CLI tool
4. **Flexibility**: Can be disabled for CI/CD with `headless: true`
5. **No Code Changes**: Existing SDK code continues to work (default behavior adds browser)

## Compatibility

- Works on macOS, Linux, and Windows
- Requires the `open` npm package (already a dependency)
- Debugger server starts automatically when needed
- Falls back gracefully if browser can't be opened (prints URL)

## Testing

Run the test to verify functionality:

```bash
TD_API_KEY=your_key npx vitest run testdriver/acceptance-sdk/sandbox-render.test.mjs
```

Or try the examples:

```bash
# With browser rendering
TD_API_KEY=your_key node examples/sdk-with-browser.js

# Headless mode
TD_API_KEY=your_key node examples/sdk-headless.js
```

## Future Enhancements

Potential improvements:
- Allow custom debugger port configuration
- Support for multiple concurrent sandbox windows
- Option to disable debugger server entirely
- Custom browser selection
- Headless mode detection based on environment
