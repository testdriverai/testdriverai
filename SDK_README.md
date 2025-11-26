# TestDriver SDK

The TestDriver SDK provides programmatic access to TestDriver's AI-powered testing capabilities. Use it to automate UI testing for web and desktop applications with natural language commands.

## ✨ New: AWESOME Logs with Great DX!

Your SDK now has **beautiful, emoji-rich logging** that makes test output a joy to read! 🎨

```
[2.34s] 🔍 Found "submit button" · 📍 (682, 189) · ⏱️ 167ms · ⚡ cached
[2.51s] 👆 Click "submit button"
[2.89s] ⌨️ Type → hello world
[3.12s] ✅ Assert "page correct" · ✓ PASSED · ⏱️ 45ms
```

**Features:**

- 🎨 Rich emojis for all actions (find, click, type, scroll, etc.)
- ⚡ Cache hit/miss indicators
- ⏱️ Color-coded performance timing (green < 100ms, yellow < 500ms, red > 500ms)
- 📍 Coordinate display for found elements
- 📊 Beautiful progress bars and summaries

See [docs/AWESOME_LOGS_QUICK_REF.md](./docs/AWESOME_LOGS_QUICK_REF.md) for quick reference or [docs/SDK_AWESOME_LOGS.md](./docs/SDK_AWESOME_LOGS.md) for complete documentation.

## Installation

```bash
npm install testdriverai
```

## Quick Start

```javascript
const TestDriver = require("testdriverai");

async function runTest() {
  // Initialize SDK with your API key
  const client = new TestDriver(process.env.TD_API_KEY);

  // Authenticate and connect to a sandbox
  await client.auth();
  await client.connect();

  // Use the new find() API
  await client.focusApplication("Google Chrome");

  const searchBox = await client.find("search box").find();
  await searchBox.click();
  await client.type("testdriver.ai");
  await client.pressKeys(["enter"]);

  // Poll for element to appear
  let result = client.find("TestDriver heading");
  while (!result.found()) {
    result = await result.find();
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Clean up
  await client.disconnect();
}

runTest();
```

## New Element Finding API ✨

We've introduced a new `find()` API that provides better control over element finding and interaction. See [SDK_MIGRATION.md](./SDK_MIGRATION.md) for full migration guide.

### Basic Usage

```javascript
// Find and click an element
const button = await client.find(
  "the sign in button, black button below password",
);
await button.click();

// Check if element exists
if (button.found()) {
  console.log("Button coordinates:", button.getCoordinates());
}
```

### Polling Pattern

```javascript
// Wait for element to appear
let element;
while (!element?.found()) {
  console.log("waiting for element...");
  element = await client.find("login button");
  if (!element.found()) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
await element.click();
```

### Different Actions

```javascript
const menu = await client.find("File menu").find();
await menu.hover();
await menu.rightClick();
await menu.doubleClick();

// Or use the generic click() method with action parameter
await menu.click("right-click");
```

### Drag and Drop

```javascript
const source = await client.find("draggable item");
await source.mouseDown();

const target = await client.find("drop zone");
await target.mouseUp();
```

## API Reference

### Element Class

The `Element` class represents an element found on screen and provides methods for interacting with it.

#### Creating Elements

##### `client.find(description)`

Creates a new Element instance and immediately attempts to locate it.

**Parameters:**

- `description` (string): Natural language description of the element

**Returns:** `Promise<Element>` - Element instance (already located)

**Example:**

```javascript
const button = await client.find("the sign in button");
// Element is automatically located
if (button.found()) {
  await button.click();
}
```

#### Element Methods

##### `element.find([newDescription])`

Locates (or relocates) the element on screen.

**Parameters:**

- `newDescription` (string, optional): New description to search for

**Returns:** `Promise<Element>` - The same Element instance

**Example:**

```javascript
// Re-find the same element
await element.find();

// Find with a new description
await element.find("submit button");
```

##### `element.found()`

Check if the element was successfully located.

**Returns:** `boolean` - true if element was found

**Example:**

```javascript
if (element.found()) {
  console.log("Element located!");
}
```

##### `element.click([action])`

Click on the element.

**Parameters:**

- `action` (string, optional): Click type - `'click'`, `'right-click'`, `'double-click'`, `'mouseDown'`, `'mouseUp'` (default: `'click'`)

**Returns:** `Promise<void>`

**Example:**

```javascript
await element.click();
await element.click("right-click");
```

##### `element.hover()`

Hover the mouse over the element.

**Returns:** `Promise<void>`

**Example:**

```javascript
await element.hover();
```

##### `element.doubleClick()`

Double-click on the element. Convenience method for `element.click('double-click')`.

**Returns:** `Promise<void>`

**Example:**

```javascript
await element.doubleClick();
```

##### `element.rightClick()`

Right-click on the element. Convenience method for `element.click('right-click')`.

**Returns:** `Promise<void>`

**Example:**

```javascript
await element.rightClick();
```

##### `element.mouseDown()`

Press the mouse button down on the element (useful for drag operations).

**Returns:** `Promise<void>`

**Example:**

```javascript
const draggable = await client.find("item to drag");
await draggable.mouseDown();
```

##### `element.mouseUp()`

Release the mouse button on the element (useful for drag operations).

**Returns:** `Promise<void>`

**Example:**

```javascript
const dropZone = await client.find("drop target");
await dropZone.mouseUp();
```

##### `element.getCoordinates()`

Get the screen coordinates of the element.

**Returns:** `{x, y, centerX, centerY} | null` - Coordinates object or null if not found

**Example:**

```javascript
const coords = element.getCoordinates();
if (coords) {
  console.log(`Position: ${coords.x}, ${coords.y}`);
  console.log(`Center: ${coords.centerX}, ${coords.centerY}`);
}
```

##### `element.getResponse()`

Get the full API response data from the locate operation.

**Returns:** `Object | null` - Full response with all available data

**Example:**

```javascript
const response = element.getResponse();
console.log("Full response:", response);
```

#### Element Properties

Elements expose many read-only properties from the API response:

##### Coordinate Properties

- `element.x` - X coordinate (top-left corner) or null
- `element.y` - Y coordinate (top-left corner) or null
- `element.centerX` - X coordinate of element center or null
- `element.centerY` - Y coordinate of element center or null

##### Dimension Properties

- `element.width` - Width of the element or null
- `element.height` - Height of the element or null
- `element.boundingBox` - Bounding box object or null

##### Match Quality Properties

- `element.confidence` - Confidence score (0-1) or null
- `element.screenshot` - Base64 encoded screenshot or null
- `element.text` - Text content of the element or null
- `element.label` - Label/aria-label of the element or null

**Example:**

```javascript
const button = await client.find("login button");

if (button.found()) {
  console.log({
    position: { x: button.x, y: button.y },
    center: { x: button.centerX, y: button.centerY },
    size: { width: button.width, height: button.height },
    confidence: button.confidence,
    text: button.text,
    label: button.label,
  });

  // Save screenshot for debugging
  if (button.screenshot) {
    require("fs").writeFileSync(
      "element.png",
      Buffer.from(button.screenshot, "base64"),
    );
  }

  // Conditional actions based on properties
  if (button.confidence > 0.8) {
    await button.click();
  } else {
    console.log("Low confidence, skipping click");
  }
}
```

For more examples, see `examples/sdk-element-properties.js`.

### Initialization

#### `new TestDriver(apiKey, options)`

Creates a new TestDriver SDK instance.

**Parameters:**

- `apiKey` (string): Your TestDriver API key
- `options` (object, optional):
  - `apiRoot` (string): API endpoint (default: 'https://v6.testdriver.ai')
  - `resolution` (string): Sandbox resolution (default: '1366x768')
  - `analytics` (boolean): Enable analytics (default: true)
  - `logging` (boolean): Enable console logging output (default: true)
  - `environment` (object): Additional environment variables

**Example:**

```javascript
const client = new TestDriver(process.env.TD_API_KEY, {
  resolution: "1920x1080",
  analytics: false,
  logging: true, // See detailed logs
});
```

### Connection Methods

#### `auth()`

Authenticates with the TestDriver API.

**Returns:** `Promise<string>` - Authentication token

**Example:**

```javascript
await client.auth();
```

#### `connect(options)`

Connects to a sandbox environment.

**Parameters:**

- `options` (object, optional):
  - `sandboxId` (string): Reconnect to existing sandbox
  - `newSandbox` (boolean): Force creation of new sandbox
  - `ip` (string): Direct IP connection
  - `sandboxAmi` (string): Custom AMI for sandbox
  - `sandboxInstance` (string): Instance type
  - `headless` (boolean): Disable browser window rendering (default: false)

**Returns:** `Promise<Object>` - Sandbox instance details

**Examples:**

```javascript
// Create new sandbox (opens browser window by default)
await client.connect({ newSandbox: true });

// Create sandbox without opening browser window
await client.connect({ newSandbox: true, headless: true });

// Reconnect to existing sandbox
await client.connect({ sandboxId: "i-1234567890abcdef0" });

// Direct IP connection
await client.connect({ ip: "192.168.1.100" });
```

**Note:** By default, the SDK will automatically open a browser window showing the live sandbox environment, similar to the CLI behavior. This allows you to watch test execution in real-time. Set `headless: true` to disable this feature.

#### `disconnect()`

Disconnects from the sandbox.

**Returns:** `Promise<void>`

### Text Interaction Methods

#### `hoverText(text, description, action, method, timeout)`

Finds and hovers over text on screen.

**Parameters:**

- `text` (string): Text to find
- `description` (string, optional): Additional context
- `action` (string): Action type (default: 'click')
- `method` (string): Match method - 'turbo', 'leven', or 'dice' (default: 'turbo')
- `timeout` (number): Timeout in ms (default: 5000)

**Returns:** `Promise<Object>` - Match result with coordinates

**Example:**

```javascript
const result = await client.hoverText("Submit", "the submit button");
console.log(result); // { x: 150, y: 200, ... }
```

#### `type(text, delay)`

Types text with optional delay between keystrokes.

**Parameters:**

- `text` (string): Text to type
- `delay` (number): Delay in ms between keystrokes (default: 250)

**Example:**

```javascript
await client.type("hello@example.com", 100);
```

#### `waitForText(text, timeout, method, invert)`

Waits for text to appear on screen.

**Parameters:**

- `text` (string): Text to wait for
- `timeout` (number): Timeout in ms (default: 5000)
- `method` (string): Match method (default: 'turbo')
- `invert` (boolean): Wait for text to disappear (default: false)

**Example:**

```javascript
await client.waitForText("Success!", 10000);
```

#### `scrollUntilText(text, direction, maxDistance, textMatchMethod, method, invert)`

Scrolls until text is found.

**Parameters:**

- `text` (string): Text to find
- `direction` (string): 'up' or 'down' (default: 'down')
- `maxDistance` (number): Max pixels to scroll (default: 10000)
- `textMatchMethod` (string): Text matching method (default: 'turbo')
- `method` (string): Scroll method - 'mouse' or 'keyboard' (default: 'keyboard')
- `invert` (boolean): Invert match (default: false)

**Example:**

```javascript
await client.scrollUntilText("Terms of Service", "down", 5000);
```

### Image Interaction Methods

#### `hoverImage(description, action)`

Finds and hovers over an image matching the description.

**Parameters:**

- `description` (string): Description of the image
- `action` (string): Action type (default: 'click')

**Returns:** `Promise<Object>` - Match result

**Example:**

```javascript
await client.hoverImage("the red submit button");
```

#### `matchImage(imagePath, action, invert)`

Finds and interacts with an image using template matching.

**Parameters:**

- `imagePath` (string): Path to template image
- `action` (string): 'click' or 'hover' (default: 'click')
- `invert` (boolean): Invert match (default: false)

**Example:**

```javascript
await client.matchImage("./templates/login-button.png", "click");
```

#### `waitForImage(description, timeout, invert)`

Waits for an image to appear on screen.

**Parameters:**

- `description` (string): Description of the image
- `timeout` (number): Timeout in ms (default: 10000)
- `invert` (boolean): Wait for image to disappear (default: false)

**Example:**

```javascript
await client.waitForImage("loading spinner", 5000, true); // Wait for spinner to disappear
```

#### `scrollUntilImage(description, direction, maxDistance, method, path, invert)`

Scrolls until an image is found.

**Parameters:**

- `description` (string): Description of image (use either this or path)
- `direction` (string): 'up' or 'down' (default: 'down')
- `maxDistance` (number): Max pixels to scroll (default: 10000)
- `method` (string): Scroll method (default: 'keyboard')
- `path` (string): Path to template image
- `invert` (boolean): Invert match (default: false)

**Example:**

```javascript
await client.scrollUntilImage("footer logo", "down", 10000);
```

### Mouse & Keyboard Methods

#### `click(x, y, action)`

Clicks at specific coordinates.

**Parameters:**

- `x` (number): X coordinate
- `y` (number): Y coordinate
- `action` (string): Click type - 'click', 'right-click', 'double-click', 'middle-click', 'drag-start', 'drag-end' (default: 'click')

**Example:**

```javascript
await client.click(500, 300, "double-click");
```

#### `hover(x, y)`

Moves mouse to coordinates.

**Parameters:**

- `x` (number): X coordinate
- `y` (number): Y coordinate

**Example:**

```javascript
await client.hover(200, 150);
```

#### `pressKeys(keys)`

Presses keyboard keys (supports combinations).

**Parameters:**

- `keys` (Array<string>): Array of keys to press

**Example:**

```javascript
// Single key
await client.pressKeys(["enter"]);

// Key combination
await client.pressKeys(["ctrl", "c"]);

// Multiple keys in sequence
await client.pressKeys(["tab", "tab", "enter"]);
```

#### `scroll(direction, amount, method)`

Scrolls the page.

**Parameters:**

- `direction` (string): 'up' or 'down' (default: 'down')
- `amount` (number): Pixels to scroll (default: 300)
- `method` (string): 'mouse' or 'keyboard' (default: 'mouse')

**Example:**

```javascript
await client.scroll("down", 500, "mouse");
```

### Application Control

#### `focusApplication(name)`

Focuses an application by name.

**Parameters:**

- `name` (string): Application name

**Example:**

```javascript
await client.focusApplication("Google Chrome");
```

### AI-Powered Methods

#### `assert(assertion, async, invert)`

Makes an AI-powered assertion about the screen state.

**Parameters:**

- `assertion` (string): Natural language assertion
- `async` (boolean): Run asynchronously (default: false)
- `invert` (boolean): Invert the assertion (default: false)

**Example:**

```javascript
await client.assert("The login form is visible");
await client.assert("The page is showing an error message");
```

#### `remember(description)`

Extracts and remembers information from the screen.

**Parameters:**

- `description` (string): What to remember

**Returns:** `Promise<string>` - Extracted information

**Example:**

```javascript
const email = await client.remember(
  "What is the user email shown on the profile page?",
);
console.log(email); // "user@example.com"
```

### Code Execution

#### `exec(language, code, timeout, silent)`

Executes code in the sandbox.

**Parameters:**

- `language` (string): 'js' or 'pwsh'
- `code` (string): Code to execute
- `timeout` (number): Timeout in ms
- `silent` (boolean): Suppress output (default: false)

**Returns:** `Promise<string>` - Execution result

**Example:**

```javascript
// JavaScript
const result = await client.exec(
  "js",
  `
  result = { timestamp: Date.now(), platform: process.platform };
`,
  5000,
);

// PowerShell
const output = await client.exec(
  "pwsh",
  "Get-Process | Select-Object -First 5",
  10000,
);
```

### Utility Methods

#### `screenshot([scale], [silent], [mouse])`

Captures a screenshot of the current screen in the sandbox.

**Parameters:**

- `scale` (number, optional): Scale factor for the screenshot (default: 1 = original size)
- `silent` (boolean, optional): Whether to suppress logging (default: false)
- `mouse` (boolean, optional): Whether to include mouse cursor (default: false)

**Returns:** `Promise<string>` - Base64 encoded PNG screenshot

**Example:**

```javascript
// Capture a screenshot
const screenshot = await client.screenshot();

// Save to file
const fs = require("fs");
fs.writeFileSync("screenshot.png", Buffer.from(screenshot, "base64"));

// Capture with mouse cursor visible
const screenshotWithMouse = await client.screenshot(1, false, true);
fs.writeFileSync(
  "screenshot-with-mouse.png",
  Buffer.from(screenshotWithMouse, "base64"),
);
```

#### `wait(timeout)`

Waits for specified time.

**Parameters:**

- `timeout` (number): Time in ms (default: 3000)

**Example:**

```javascript
await client.wait(2000); // Wait 2 seconds
```

#### `getInstance()`

Gets the current sandbox instance details.

**Returns:** `Object|null` - Sandbox instance

#### `getSessionId()`

Gets the current session ID.

**Returns:** `string|null` - Session ID

#### `setLogging(enabled)`

Enable or disable console logging output.

**Parameters:**

- `enabled` (boolean): Whether to enable logging

**Example:**

```javascript
// Disable logging
client.setLogging(false);

// Enable logging
client.setLogging(true);
```

#### `getEmitter()`

Gets the event emitter for custom event handling.

**Returns:** `EventEmitter2` - Event emitter instance

**Example:**

```javascript
const emitter = client.getEmitter();

// Listen to all log events
emitter.on("log:*", (message) => {
  console.log("Log:", message);
});

// Listen to error events
emitter.on("error:*", (data) => {
  console.error("Error:", data);
});

// Listen to command events
emitter.on("command:start", (data) => {
  console.log("Command started:", data.command);
});

emitter.on("command:success", (data) => {
  console.log(
    "Command succeeded:",
    data.command,
    "Duration:",
    data.duration,
    "ms",
  );
});
```

## Events

The SDK emits various events that you can listen to for detailed execution information:

### Log Events

- `log:log` - General log messages
- `log:warn` - Warning messages
- `log:debug` - Debug messages
- `log:narration` - Narration text (e.g., "thinking...")
- `log:markdown:start` - Markdown streaming started
- `log:markdown:chunk` - Markdown chunk received
- `log:markdown:end` - Markdown streaming ended
- `log:markdown` - Static markdown content

### Command Events

- `command:start` - Command execution started
- `command:success` - Command completed successfully
- `command:error` - Command failed

### Error Events

- `error:fatal` - Fatal error occurred
- `error:general` - General error
- `error:sdk` - SDK-related error
- `error:sandbox` - Sandbox-related error

### Sandbox Events

- `sandbox:connected` - Connected to sandbox
- `sandbox:authenticated` - Authenticated with sandbox
- `sandbox:error` - Sandbox error
- `sandbox:disconnected` - Disconnected from sandbox

### Other Events

- `status` - Status update
- `mouse-click` - Mouse click occurred
- `mouse-move` - Mouse moved
- `matches:show` - Match results available

**Example: Custom Event Handling**

```javascript
const TestDriver = require("testdriverai");

const client = new TestDriver(process.env.TD_API_KEY, {
  logging: false, // Disable default logging
});

const emitter = client.getEmitter();

// Custom logging
emitter.on("log:*", (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
});

// Track command performance
const commandTimes = {};
emitter.on("command:start", (data) => {
  commandTimes[data.command] = Date.now();
});

emitter.on("command:success", (data) => {
  const duration = Date.now() - commandTimes[data.command];
  console.log(`✓ ${data.command} completed in ${duration}ms`);
});

emitter.on("command:error", (data) => {
  console.error(`✗ ${data.command} failed: ${data.error}`);
});

await client.auth();
await client.connect();
await client.hoverText("Submit");
```

## Complete Example

```javascript
const TestDriver = require("testdriverai");

async function testLoginFlow() {
  const client = new TestDriver(process.env.TD_API_KEY);

  try {
    // Setup
    await client.auth();
    await client.connect({ newSandbox: true });

    // Open browser and navigate
    await client.focusApplication("Google Chrome");
    await client.wait(1000);

    // Type URL and navigate
    await client.type("https://example.com/login");
    await client.pressKeys(["enter"]);
    await client.waitForText("Login", 5000);

    // Fill login form
    await client.hoverText("Email");
    await client.type("test@example.com");
    await client.pressKeys(["tab"]);
    await client.type("password123");

    // Submit form
    await client.hoverText("Sign In");
    await client.pressKeys(["enter"]);

    // Verify login
    await client.waitForText("Dashboard", 10000);
    await client.assert("User is logged in successfully");

    // Get user info
    const username = await client.remember(
      "What is the username displayed in the header?",
    );
    console.log("Logged in as:", username);
  } catch (error) {
    console.error("Test failed:", error);
    throw error;
  } finally {
    await client.disconnect();
  }
}

testLoginFlow();
```

## Environment Variables

- `TD_API_KEY`: Your TestDriver API key (required)
- `TD_API_ROOT`: API endpoint (optional, default: https://v6.testdriver.ai)
- `TD_RESOLUTION`: Sandbox resolution (optional, default: 1366x768)
- `TD_ANALYTICS`: Enable analytics (optional, default: true)
- `VERBOSE` / `DEBUG` / `TD_DEBUG`: Enable verbose debug output including cache information

## Configuration Options

### Cache Behavior (v7.0+)

**⚠️ Important:** By default, caching is **DISABLED** to avoid unnecessary AI costs. To enable caching for a test run, you must provide a `cacheKey`.

**Why use cacheKey?**

- Groups related find operations (e.g., all finds in a single test run)
- Enables cache hits across multiple test executions with the same key
- Avoids unwanted cache hits from unrelated tests
- Gives you explicit control over when caching is active

**Basic Usage:**

```javascript
// NO caching - fresh AI lookup every time (default behavior)
const element = await client.find("login button");

// WITH caching - enable by providing a cacheKey
const element = await client.find("login button", {
  cacheKey: "my-test-run-123",
});

// All finds with the same cacheKey share cache
const email = await client.find("email field", { cacheKey: "my-test-run-123" });
const password = await client.find("password field", {
  cacheKey: "my-test-run-123",
});
```

**Legacy cache threshold syntax still supported:**

```javascript
// Override cache threshold (legacy - still works)
const element = await client.find("login button", 0.01); // 99% similarity
```

**New combined syntax:**

```javascript
// Provide both cacheKey and custom threshold
const element = await client.find("login button", {
  cacheKey: "my-test-run",
  cacheThreshold: 0.01, // 99% similarity required for cache hit
});
```

**Using with findAll():**

```javascript
// No caching (default)
const buttons = await client.findAll("button");

// With caching enabled
const buttons = await client.findAll("button", {
  cacheKey: "my-test-run",
});
```

**Best Practices:**

```javascript
// Use unique cacheKey per test run
const cacheKey = `test-${Date.now()}`;

// Or use a consistent key for regression tests
const cacheKey = "login-flow-v1";

async function testLogin() {
  // All finds in this test share the same cache
  const email = await client.find("email input", { cacheKey });
  const password = await client.find("password input", { cacheKey });
  const submit = await client.find("submit button", { cacheKey });

  await email.click();
  await client.type("user@example.com");
  await password.click();
  await client.type("password123");
  await submit.click();
}
```

### Cache Thresholds

Configure cache sensitivity for element finding operations. Lower thresholds require higher similarity for cache hits.

**Global Configuration (Deprecated):**

```javascript
// Old way: Configure global cache thresholds
// Note: As of v7.0+, cache is disabled by default
// These settings only affect finds when cacheKey IS provided
const client = new TestDriver(process.env.TD_API_KEY, {
  cacheThreshold: {
    find: 0.03, // 3% difference = 97% similarity required (stricter)
    findAll: 0.05, // 5% difference = 95% similarity required (default)
  },
});
```

**Disable Cache Globally (Deprecated):**

```javascript
// Force all find operations to skip cache even if cacheKey is provided
const client = new TestDriver(process.env.TD_API_KEY, {
  cache: false,
});
```

**Note:** As of v7.0+, it's recommended to control caching per-find using the `cacheKey` parameter rather than global settings.

**Per-Command Configuration (Deprecated):**

```javascript
// Old way: Override cache threshold for a specific find
// Note: This disables cache unless you also provide cacheKey
const element = await client.find("login button", 0.01); // 99% similarity required

// Old way: Override cache threshold for a specific findAll
const items = await client.findAll("list items", 0.1); // 90% similarity required

// Disable cache for a specific find (always regenerate)
const element = await client.find("login button", -1);
```

**New Recommended Approach:**

Use the `cacheKey` parameter to enable caching and optionally customize the threshold:

```javascript
// Enable cache with default threshold (95% similarity)
const element = await client.find("login button", { cacheKey: "test-run-1" });

// Enable cache with custom threshold
const element = await client.find("login button", {
  cacheKey: "test-run-1",
  cacheThreshold: 0.01, // 99% similarity required
});
```

**Cache Threshold Values:**

- `0.01` - Very strict (99% similarity required)
- `0.03` - Strict (97% similarity required)
- `0.05` - Default (95% similarity required)
- `0.10` - Relaxed (90% similarity required)

### Debugging Cache Behavior

Enable verbose output to see cache hit/miss information:

```bash
VERBOSE=true node your-test.js
```

Debug output includes:

- Cache hit/miss status
- Cache strategy used (image/text)
- Similarity scores for cache matches
- Response times
- Debug images with element highlights

Example debug output:

```
🔍 Element Found:
  Description: login button
  Coordinates: (523, 345)
  Duration: 1234ms
  Cache Hit: ✅ YES
  Cache Strategy: text
  Similarity: 98.50%
  Confidence: 95.20%
  Debug Image: /tmp/testdriver-debug/element-found-1234567890.png
```

## Error Handling

The SDK throws errors when operations fail. Always wrap your code in try-catch blocks:

```javascript
try {
  await client.hoverText("Submit");
} catch (error) {
  console.error("Failed to find Submit button:", error.message);
  // Handle error appropriately
}
```

## Best Practices

1. **Always authenticate and connect before running commands**

   ```javascript
   await client.auth();
   await client.connect();
   ```

2. **Use appropriate timeouts for slow operations**

   ```javascript
   await client.waitForText("Loading...", 30000); // 30 second timeout
   ```

3. **Clean up after tests**

   ```javascript
   try {
     // Your test code
   } finally {
     await client.disconnect();
   }
   ```

4. **Use natural language assertions for validation**

   ```javascript
   await client.assert("The form was submitted successfully");
   ```

5. **Add waits between actions to let UI settle**
   ```javascript
   await client.click(100, 200);
   await client.wait(1000); // Let UI respond
   ```

## Support

- Documentation: https://docs.testdriver.ai
- Discord: https://discord.com/invite/cWDFW8DzPm
- GitHub: https://github.com/testdriverai/cli

## License

ISC
