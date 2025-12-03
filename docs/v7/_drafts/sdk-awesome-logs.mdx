# TestDriver SDK - AWESOME Logs 🎨

Beautiful, emoji-rich logging with incredible DX that makes your test output a joy to read!

## Features

✨ **Rich Emojis & UTF-8** - Full emoji support now that dashcam supports UTF-8!  
🎨 **Color-Coded Actions** - Different colors for different action types  
⚡ **Performance Indicators** - Color-coded duration times (green < 100ms, yellow < 500ms, red > 500ms)  
📊 **Progress Tracking** - Beautiful progress bars for multi-step operations  
🔍 **Cache Visualization** - Clear indication of cache hits/misses  
📍 **Coordinate Display** - See exactly where elements are found  
⏱️ **Timing Information** - Elapsed time from test start on every log  
📦 **Beautiful Headers** - Box-drawn section headers for organization  

## Log Types

### 🔍 Element Finding

```javascript
const element = await client.find("submit button");
```

**Output:**
```
[2.34s] 🔍 Found "submit button" · 📍 (682, 189) · ⏱️ 167ms · ⚡ cached
```

Features:
- Green checkmark for successful finds
- Coordinates with pin emoji
- Duration with color coding
- Cache status with lightning bolt

### 👆 User Actions

```javascript
await element.click();
await element.hover();
await client.type("hello world");
```

**Output:**
```
[2.51s] 👆 Click "submit button"
[2.67s] 👉 Hover "menu item"
[2.89s] ⌨️ Type → hello world
```

Action emojis:
- 👆 Click
- 👆👆 Double-click
- 🖱️ Right-click
- 👉 Hover
- ⌨️ Type
- 🎹 Press Keys
- 📜 Scroll

### ✅ Assertions

```javascript
await client.assert("page title is Example Domain");
```

**Output:**
```
[3.12s] ✅ Assert "page title is Example Domain" · ✓ PASSED · ⏱️ 45ms
[3.45s] ❌ Assert "login form visible" · ✗ FAILED · ⏱️ 1234ms
```

Color-coded results:
- ✅ Green for PASSED
- ❌ Red for FAILED
- Performance-based duration coloring

### ⚡ Cache Performance

The SDK automatically logs cache performance:

**Cache HIT:**
```
⚡ Cache HIT · 98.5% similar · image strategy
```

**Cache MISS:**
```
💤 Cache MISS · text strategy
```

### 🔌 Connection Status

```javascript
await client.connect();
await client.disconnect();
```

**Output:**
```
🔌 Connected · Sandbox: i-0a1b2c3d4e5f6 · OS: windows
🔌 Disconnected
```

### 📸 Screenshots

```javascript
await client.screenshot();
```

**Output:**
```
[5.67s] 📸 Screenshot · /tmp/testdriver-debug/screenshot-123.png · 245 KB
```

### 🚨 Errors

Errors are beautifully formatted with context:

```
[8.90s] ❌ Element not found → Timeout after 5000ms
```

### 📈 Progress Tracking

For multi-step operations:

```
Progress ████████████████████ 100% 5/5 · Processing complete
```

### 📊 Test Summary

At the end of your test suite:

```
────────────────────────────────────────────────────────────
✓ 12 passed │ ✗ 2 failed │ ⊘ 1 skipped │ 15 total │ ⏱️ 45.23s
────────────────────────────────────────────────────────────
```

### 📦 Section Headers

Organize your test output with beautiful headers:

```
╭────────────────────────────────────────────────────────────╮
│ ✨ User Authentication Flow                                │
╰────────────────────────────────────────────────────────────╯
```

## Configuration

### Enable/Disable Logging

```javascript
const client = new TestDriver(apiKey, {
  logging: true,  // Enable logging (default)
});

// Or disable later
client.setLogging(false);
```

### Emojis vs Simple Symbols

The formatter automatically uses emojis when available. If you need to disable emojis:

```javascript
const { formatter } = require('testdriverai/sdk-log-formatter');
formatter.useEmojis = false; // Falls back to simple Unicode symbols
```

### Test Context Integration

Integrate with Vitest or other test frameworks:

```javascript
import { describe, it, beforeEach } from 'vitest';

describe('Login Tests', () => {
  let client;

  beforeEach(() => {
    client = new TestDriver(process.env.TD_API_KEY);
    
    // Set test context for better logging
    client.setTestContext({
      file: 'login.test.js',
      test: 'should log in successfully',
      startTime: Date.now()
    });
  });

  it('should log in successfully', async () => {
    // All logs will now include elapsed time from test start
    await client.connect();
    // ...test code...
  });
});
```

## Examples

### Basic Usage

```javascript
const TestDriver = require('testdriverai');

const client = new TestDriver(process.env.TD_API_KEY, {
  logging: true,
});

await client.connect();

// Find and click - logs automatically
const button = await client.find('submit button');
await button.click();

await client.disconnect();
```

**Output:**
```
🔌 Connected · Sandbox: i-0a1b2c3d · OS: windows
🔍 Found "submit button" · 📍 (682, 189) · ⏱️ 167ms · ⚡ cached
👆 Click "submit button"
🔌 Disconnected
```

### Manual Formatting

You can also use the formatter directly for custom logs:

```javascript
const { formatter } = require('testdriverai/sdk-log-formatter');

// Format custom messages
console.log(formatter.formatHeader('My Test Suite', '🧪'));
console.log(formatter.formatAction('custom action', 'my element'));
console.log(formatter.formatProgress(3, 10, 'Processing...'));
console.log(formatter.formatDivider());
```

### Performance Monitoring

Duration colors help you spot slow operations:

- **🟢 Green** (< 100ms): Fast, optimal
- **🟡 Yellow** (100-500ms): Acceptable
- **🔴 Red** (> 500ms): Slow, may need optimization

Example output:
```
⏱️ 45ms   ← Green (fast)
⏱️ 234ms  ← Yellow (acceptable)
⏱️ 1.2s   ← Red (slow)
```

### Cache Monitoring

Track cache effectiveness in real-time:

```javascript
// Enable cache debugging
process.env.VERBOSE = 'true';

// Now you'll see detailed cache info
const element = await client.find('button');
```

**Output:**
```
🔍 find() threshold: 0.05 (cache ENABLED)
🔍 Found "button" · 📍 (500, 300) · ⏱️ 89ms · ⚡ cached

Element Found:
  Description: button
  Coordinates: (500, 300)
  Duration: 89ms
  Cache Hit: ✅ YES
  Cache Strategy: image
  Similarity: 98.50%
  Cache Age: 2s (created: 2024-11-18T15:30:45.123Z)
  Pixel Diff: 1.23%
```

## Advanced Features

### Test Lifecycle Tracking

```javascript
const { formatter } = require('testdriverai/sdk-log-formatter');

// Test start
console.log(formatter.formatTestStart('Login Flow'));

// ... test code ...

// Test end
console.log(formatter.formatTestEnd('Login Flow', true, 2345));
```

**Output:**
```
▶️ Running: Login Flow

✅ PASSED Login Flow · 2.35s
```

### Multi-Step Workflows

```javascript
const steps = [
  'Navigate to login',
  'Enter credentials',
  'Submit form',
  'Verify dashboard',
  'Logout'
];

for (let i = 0; i < steps.length; i++) {
  console.log(formatter.formatProgress(i + 1, steps.length, steps[i]));
  // ... perform step ...
}
```

**Output:**
```
Progress ████░░░░░░░░░░░░░░░░ 20% 1/5 · Navigate to login
Progress ████████░░░░░░░░░░░░ 40% 2/5 · Enter credentials
Progress ████████████░░░░░░░░ 60% 3/5 · Submit form
Progress ████████████████░░░░ 80% 4/5 · Verify dashboard
Progress ████████████████████ 100% 5/5 · Logout
```

### Error Reporting

```javascript
try {
  await client.find('non-existent element');
} catch (error) {
  console.log(formatter.formatError('Element search failed', error));
}
```

**Output:**
```
❌ Element search failed → Element "non-existent element" not found.

=== Debug Information ===
Element searched for: "non-existent element"
Cache threshold: 0.05 (95.0% similarity required)
Cache: MISS
Similarity score: 45.23%
Current screenshot: /tmp/testdriver-debug/screenshot-1234.png
```

## Tips for Great Logs

1. **Use descriptive element descriptions** - They appear in the logs!
   ```javascript
   // ✅ Good
   await client.find('blue submit button in login form');
   
   // ❌ Less helpful
   await client.find('button');
   ```

2. **Leverage test context** - Set it once, get timestamps on all logs
   ```javascript
   client.setTestContext({
     test: 'User Login',
     startTime: Date.now()
   });
   ```

3. **Monitor cache performance** - Use VERBOSE mode during development
   ```bash
   VERBOSE=true node my-test.js
   ```

4. **Organize with headers** - Make long test output scannable
   ```javascript
   console.log(formatter.formatHeader('Setup Phase', '⚙️'));
   // ... setup code ...
   
   console.log(formatter.formatHeader('Test Execution', '🧪'));
   // ... test code ...
   ```

5. **Track progress** - Show users what's happening in long-running tests
   ```javascript
   for (let i = 0; i < items.length; i++) {
     console.log(formatter.formatProgress(i + 1, items.length));
     // ... process item ...
   }
   ```

## Demo

Run the comprehensive demo to see all logging features:

```bash
TD_API_KEY=your_key node examples/sdk-awesome-logs-demo.js
```

Or check out the cache thresholds example:

```bash
TD_API_KEY=your_key VERBOSE=true node examples/sdk-cache-thresholds.js
```

## Color Reference

The logging system uses consistent color coding:

- **🔵 Blue**: Info, navigation, system messages
- **🟢 Green**: Success, passed assertions, fast operations
- **🟡 Yellow**: Warnings, caching, acceptable performance
- **🔴 Red**: Errors, failures, slow operations
- **🟣 Magenta**: Finding/searching operations
- **🔵 Cyan**: User actions, interactive elements
- **⚪ Gray**: Debug info, metadata, timestamps

## Emoji Reference

### Actions
- 👆 Click / Tap
- 👉 Hover / Point
- ⌨️ Type / Keyboard input
- 🎹 Press keys
- 📜 Scroll
- 🖱️ Right-click
- ✊ Drag

### Status
- ✅ Success / Passed
- ❌ Error / Failed
- ⚠️ Warning
- ℹ️ Info
- 🔧 Debug

### Operations
- 🔍 Find / Search
- 🔎 Find all
- 📸 Screenshot
- 🧠 Remember (AI)
- 🎯 Focus
- ⚡ Cache hit
- 💤 Cache miss

### System
- 🔌 Connect / Disconnect
- 🚀 Launch / Start
- 🏁 Finish / End
- ⏳ Waiting / Loading
- ⏱️ Duration / Time
- 📍 Location / Coordinates
- 📊 Statistics / Summary
- 📈 Progress

### Organizational
- ✨ Header / Title
- 📦 Section / Group
- ▶️ Running / Active
- 🎉 Complete / Success
- 🚨 Alert / Critical

Enjoy your AWESOME logs! 🎨✨
