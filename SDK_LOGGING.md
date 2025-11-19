# TestDriver SDK - Formatted Logging for Dashcam

The TestDriver SDK now includes clean, structured logging that makes logs easy to read when replayed in Dashcam.

## Features

✨ **Clean, structured formatting** with clear labels and timestamps  
⏱️ **Timestamp tracking** showing elapsed time from test start  
🎯 **Action-specific formatting** for find, click, type, hover, scroll, assert  
⚡ **Cache indicators** showing when elements are found from cache  
📊 **Test context integration** with Vitest test information  
🎥 **Dashcam-optimized** - no emojis or ANSI codes, pure text format

## How It Works

All logs sent through the `log:log` event are automatically formatted before being sent to Dashcam. This means when you replay your test in Dashcam, you'll see beautiful, easy-to-read logs with:

- **Clear prefixes** like `[FIND]`, `[CLICK]`, `[ASSERT]` for different action types
- **Highlighted information** for element descriptions and coordinates
- **Elapsed timestamps** from test start like `[30.59s]`
- **Cache hit indicators** showing performance optimizations with `(cached)`
- **Duration information** for operations

## Usage

### Basic Setup

The formatter is automatically integrated into the SDK. Just use the SDK normally:

```javascript
import { afterAll, beforeAll, describe, it } from "vitest";
import {
  createTestClient,
  setupTest,
  teardownTest,
} from "./setup/testHelpers.mjs";

describe("My Test", () => {
  let testdriver;

  beforeAll(async () => {
    testdriver = createTestClient();
    await setupTest(testdriver);
  });

  afterAll(async () => {
    await teardownTest(testdriver);
  });

  it("should have nice logs", async () => {
    // Logs are automatically formatted!
    const button = await testdriver.find("Submit button");
    await button.click();
  });
});
```

### Enhanced Logging with Test Context

For even better logging with timestamps, set the test context:

```javascript
beforeAll(async () => {
  testdriver = createTestClient();

  // Set test context for enhanced logging
  testdriver.setTestContext({
    file: "my-test.spec.mjs",
    test: "My Test Suite",
    startTime: Date.now(),
  });

  await setupTest(testdriver);
});
```

This enables elapsed time display like `[30.59s]` in your logs.

## Log Format Examples

### Element Found

```
[30.59s] [FIND] Found "Submit button" at (682, 478) 1597ms (cached)
```

### Click Action

```
[35.43s] [CLICK] Click "Submit button"
```

### Hover Action

```
[12.15s] [HOVER] Hover "Menu item"
```

### Type Action

```
[8.32s] [TYPE] Type "user@example.com"
```

### Assertion

```
[42.10s] [ASSERT] "form submission successful" PASSED
```

### Error

```
[15.23s] [FAIL] Failed to save debug image - Error: ENOENT: no such file or directory
```

## Formatter API

The formatter is available through the `sdk-log-formatter.js` module:

```javascript
const { formatter } = require("./sdk-log-formatter");

// Format different types of messages
formatter.formatElementFound("Button", {
  x: 100,
  y: 200,
  duration: "1500ms",
  cacheHit: true,
});
formatter.formatAction("click", "Submit button");
formatter.formatAssertion("form is visible", true);
formatter.formatError("Connection failed", error);
```

### Available Methods

- `formatElementFound(description, meta)` - Format element discovery
- `formatAction(action, description, meta)` - Format user actions
- `formatAssertion(assertion, passed, meta)` - Format test assertions
- `formatError(message, error)` - Format error messages
- `formatHeader(title)` - Create section headers
- `formatSummary(stats)` - Format test summaries
- `setTestContext(context)` - Update test context for timing

## Dashcam Compatibility

The formatter is designed specifically for Dashcam replay compatibility:

- **No emojis** - Uses text labels like `[FIND]`, `[CLICK]` instead of icons
- **No ANSI colors** - Plain text formatting that displays correctly in all environments
- **No special characters** - Simple ASCII characters only
- **Clean structure** - Easy to read in logs without terminal formatting

## Integration with Dashcam

When you run tests with Dashcam recording:

1. The SDK sends formatted logs to the `log:log` event
2. These logs are forwarded to the sandbox via `_forwardLogToSandbox()`
3. Dashcam captures and stores these logs with precise timestamps
4. When you replay in Dashcam, you see beautifully formatted logs synchronized with the video

### Example Workflow

```bash
# Run tests with Dashcam
npx vitest run testdriver/acceptance-sdk/formatted-logging.test.mjs

# View the replay with formatted logs
# Open the Dashcam URL from the test output
```

## Customization

### Custom Action Types

Add custom action types to the formatter:

```javascript
// In sdk-log-formatter.js, add to getPrefix():
const prefixes = {
  // ...existing prefixes
  myAction: "[CUSTOM]",
};
```

### Custom Message Formatting

Override the `formatMessage` method for custom text highlighting:

```javascript
formatMessage(type, message) {
  // Add custom highlighting
  message = message.replace(/\[custom\]/g, chalk.green('[custom]'));
  return super.formatMessage(type, message);
}
```

## Examples

See `testdriver/acceptance-sdk/formatted-logging.test.mjs` for a complete example.

## Benefits for Dashcam Replay

- **Better debugging**: Quickly identify what happened at each step
- **Professional appearance**: Share polished test recordings with stakeholders
- **Faster analysis**: Labeled actions make it easy to scan logs
- **Context awareness**: Timestamps help correlate logs with video timeline
- **Performance insights**: Cache indicators show optimization opportunities
- **Universal compatibility**: Works in any environment without terminal support

## Technical Details

The formatter uses:

- **Plain text formatting** for universal compatibility
- **Event emitters** to intercept log events
- **Base64 encoding** for safe transmission to sandbox
- **Test context** from Vitest for timing information

Logs are sent through the existing `log:log` event system, ensuring compatibility with all existing TestDriver infrastructure.
