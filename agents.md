# TestDriver AI Agent Guide 🤖

**This guide is specifically designed for AI agents (like Claude) to autonomously write, debug, and execute TestDriver tests.**

TestDriver is an AI-native testing SDK that allows you to write natural language tests that run in real cloud sandboxes. Tests interact with applications using AI-powered element finding and assertions.

---

## Quick Setup

### 1. Initialize a New Project

Run the initialization command to scaffold a complete TestDriver project:

```bash
npx testdriverai init
```

This command will:
- Create `package.json` with test scripts
- Set up Vitest configuration
- Generate example tests
- Add GitHub Actions workflow
- Install dependencies
- Prompt for your API key (saved to `.env`)

### 2. Get Your API Key

Users need a TestDriver API key from [console.testdriver.ai/team](https://console.testdriver.ai/team).

**Sign up required** - Users must create an account to get their API key.

### 3. Set Environment Variable

Add the API key to `.env`:

```bash
TD_API_KEY=tdai-1234567890abcdef
```

**Important:** Never commit API keys to version control. Always use environment variables.

---

## Understanding Sandboxes

**Sandboxes are mostly empty when they start.** You must provision them with an application before running tests.

### Provisioning Methods

Use these shortcuts to quickly set up common applications:

```javascript
// Chrome browser (fastest - use Linux)
await testdriver.provision.chrome({ 
  url: 'https://example.com' 
});

// VS Code
await testdriver.provision.vscode({ 
  url: 'https://github.com/user/repo' 
});

// Electron app
await testdriver.provision.electron({ 
  appPath: '/path/to/app' 
});
```

### Platform Selection

**Important:** Linux sandboxes are **faster and cheaper** than Windows sandboxes. Use Linux unless you specifically need Windows.

```javascript
// Use Linux (recommended)
const testdriver = TestDriver(context, { 
  headless: true  // defaults to Linux
});

// Use Windows (if required)
const testdriver = TestDriver(context, { 
  headless: true,
  platform: 'windows'
});
```

---

## Core Test Pattern

### Basic Test Structure

```javascript
import { test } from 'vitest';
import { TestDriver } from 'testdriverai/vitest/hooks';

test('my test name', async (context) => {
  const testdriver = TestDriver(context, { headless: true });
  
  // Provision the sandbox with Chrome
  await testdriver.provision.chrome({ 
    url: 'https://example.com' 
  });
  
  // Find and interact with elements
  const button = await testdriver.find('submit button');
  await button.click();
  
  // Assert expected state
  await testdriver.assert('success message is visible');
});
```

---

## Core API Methods

### Finding Elements

**Prefer using `find()` for interactions.** It's AI-powered and works with natural language descriptions.

```javascript
// Find by description
const button = await testdriver.find('blue submit button');
const input = await testdriver.find('username input field');
const link = await testdriver.find('More information link');

// Find returns an element object
console.log(button);
// {
//   x: 682,
//   y: 189,
//   width: 120,
//   height: 40,
//   description: 'blue submit button',
//   similarity: 0.98,
//   strategy: 'text',
//   screenshot: '/path/to/screenshot.png'
// }
```

#### Debug Information in find()

The element object contains **extensive debug information** useful for troubleshooting:

```javascript
const element = await testdriver.find('submit button');

// Available debug properties:
element.x            // X coordinate
element.y            // Y coordinate  
element.width        // Element width
element.height       // Element height
element.description  // Your search query
element.similarity   // Match confidence (0-1)
element.strategy     // How it was found: 'text', 'image', 'cache'
element.screenshot   // Path to debug screenshot
element.found()      // Boolean: was element found?
```

#### Checking if Element Was Found

```javascript
const element = await testdriver.find('submit button');

if (element.found()) {
  await element.click();
} else {
  console.log(`Element not found. Similarity: ${element.similarity}`);
  console.log(`Screenshot: ${element.screenshot}`);
}
```

#### Re-finding Elements

You can call `.find()` again on an element to retry:

```javascript
let button = await testdriver.find('submit button');

// If not found, try again
if (!button.found()) {
  button = await button.find();
}
```

### Clicking Elements

```javascript
// Click an element
const button = await testdriver.find('submit button');
await button.click();

// Click at specific coordinates
await testdriver.click(500, 300);

// Right-click
await testdriver.click(500, 300, { button: 'right' });

// Double-click
await testdriver.click(500, 300, { clickCount: 2 });
```

### Typing Text

```javascript
// Click a field first, then type
const usernameField = await testdriver.find('username input');
await usernameField.click();
await testdriver.type('standard_user');

// Type with modifiers
await testdriver.type('Hello World', { delay: 100 });
```

### Pressing Keys

```javascript
// Press single keys
await testdriver.pressKeys(['enter']);

// Keyboard shortcuts
await testdriver.pressKeys(['ctrl', 't']);  // New tab
await testdriver.pressKeys(['ctrl', 'shift', 'i']);  // DevTools

// Common shortcuts
await testdriver.pressKeys(['ctrl', 'c']);  // Copy
await testdriver.pressKeys(['ctrl', 'v']);  // Paste
```

### Hovering

```javascript
// Hover over an element
const menuItem = await testdriver.find('dropdown menu');
await menuItem.hover();

// Hover at coordinates
await testdriver.hover(400, 200);
```

### Scrolling

```javascript
// Scroll down
await testdriver.scroll('down', 3);

// Scroll up
await testdriver.scroll('up', 2);

// Scroll until element is visible
const element = await testdriver.find('footer');
while (!element.found()) {
  await testdriver.scroll('down', 1);
  await element.find();
}
```

### Assertions

```javascript
// AI-powered assertions
await testdriver.assert('login form is visible');
await testdriver.assert('error message shows "Invalid credentials"');
await testdriver.assert('user is on the dashboard page');

// Returns true/false
const result = await testdriver.assert('page loaded successfully');
expect(result).toBeTruthy();
```

### Screenshots

**Screenshots are extremely useful for debugging.** Use them liberally when tests fail.

```javascript
// Take a screenshot
const screenshot = await testdriver.screenshot();
console.log(`Screenshot saved to: ${screenshot.path}`);

// Screenshot returns metadata
// {
//   path: '/tmp/testdriver-debug/screenshot-1234.png',
//   width: 1920,
//   height: 1080,
//   size: 245678  // bytes
// }
```

### Focusing Applications

```javascript
// Switch between applications
await testdriver.focusApplication('Google Chrome');
await testdriver.focusApplication('Visual Studio Code');
```

### Executing Shell Commands

```javascript
// Execute shell command (Linux/Mac)
await testdriver.exec('sh', 'ls -la');

// Execute PowerShell (Windows)
await testdriver.exec('pwsh', 'Get-Process');
```

---

## Sandbox Reconnection (CRITICAL for Iterative Development)

**Sandboxes stay alive for a few minutes after test runs.** This is EXTREMELY useful for iterative test development.

### The Reconnect Pattern

When developing tests, use `reconnect: true` option to reconnect to the same sandbox:

```javascript
test('iterative development', async (context) => {
  const testdriver = TestDriver(context, { 
    headless: true,
    reconnect: true  // Reconnect to existing sandbox
  });
  
  // STEP 1: Initial setup (run once)
  // await testdriver.provision.chrome({ url: 'https://example.com' });
  // await testdriver.find('login button').click();
  
  // STEP 2: Comment out working steps, add new ones
  // await testdriver.find('username field').click();
  // await testdriver.type('user@example.com');
  
  // STEP 3: Continue iterating
  await testdriver.find('password field').click();
  await testdriver.type('password123');
  await testdriver.find('submit button').click();
});
```

**Workflow:**
1. Run test: `TD_API_KEY=xxx npm test`
2. Test fails at step 3
3. Comment out steps 1-2 (already completed in sandbox)
4. Add/fix step 3
5. Add `reconnect: true` to TestDriver options
6. Run again: `npm test`
7. Sandbox reconnects, skips commented steps, runs new code
8. Repeat until test passes

**Benefits:**
- Don't waste time re-running working steps
- Faster iteration cycles
- Debug specific failing steps
- Preserve sandbox state

---

## Debugging Failed Finds

When `find()` fails, use the debug information to understand why:

### Check Similarity Score

```javascript
try {
  const button = await testdriver.find('submit button');
  await button.click();
} catch (error) {
  console.log(`❌ Find failed`);
  console.log(`Similarity: ${error.similarity}`);
  console.log(`Threshold: ${error.threshold}`);
  console.log(`Screenshot: ${error.screenshot}`);
}
```

### Use Screenshots to Debug

```javascript
// Take screenshot before finding
const before = await testdriver.screenshot();
console.log(`Before screenshot: ${before.path}`);

try {
  await testdriver.find('submit button').click();
} catch (error) {
  console.log(`Element not found. Check screenshot: ${error.screenshot}`);
  
  // Take another screenshot to see current state
  const after = await testdriver.screenshot();
  console.log(`After screenshot: ${after.path}`);
}
```

### Iterative Selector Refinement

Try multiple descriptions if the first doesn't work:

```javascript
const selectors = [
  'submit button',
  'blue submit button',
  'submit button below password field',
  'button with text Submit',
  'sign in button'
];

let element = null;
for (const selector of selectors) {
  console.log(`🔍 Trying: "${selector}"`);
  
  try {
    element = await testdriver.find(selector);
    if (element.found()) {
      console.log(`✅ Found with: "${selector}"`);
      console.log(`   Similarity: ${element.similarity}`);
      console.log(`   Coordinates: (${element.x}, ${element.y})`);
      break;
    }
  } catch (error) {
    console.log(`❌ Failed: "${selector}"`);
    console.log(`   Similarity: ${error.similarity}`);
  }
}

if (element && element.found()) {
  await element.click();
} else {
  throw new Error('Could not find element with any selector');
}
```

### Add More Context to Descriptions

More specific descriptions often work better:

```javascript
// ❌ Too vague
await testdriver.find('button');

// ✅ More specific
await testdriver.find('blue submit button below password field');

// ✅ Include visual context
await testdriver.find('Sign In button, black button with white text');

// ✅ Include position
await testdriver.find('submit button in bottom right corner');
```

---

## Example Tests from Test Suite

### Example 1: Assert Test
*From: `test/testdriver/assert.test.mjs`*

```javascript
import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/vitest/hooks";

describe("Assert Test", () => {
  it("should assert the testdriver login page shows", async (context) => {
    const testdriver = TestDriver(context);
    
    await testdriver.provision.chrome({
      url: 'http://testdriver-sandbox.vercel.app/login',
    });

    const result = await testdriver.assert(
      "the TestDriver.ai Sandbox login page is displayed",
    );

    expect(result).toBeTruthy();
  });
});
```

### Example 2: Hover and Click
*From: `test/testdriver/hover-text.test.mjs`*

```javascript
import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/vitest/hooks";

describe("Hover Text Test", () => {
  it("should click Sign In and verify error message", async (context) => {
    const testdriver = TestDriver(context, { 
      headless: true
    });
    
    await testdriver.provision.chrome({ 
      url: 'http://testdriver-sandbox.vercel.app/login' 
    });

    const signInButton = await testdriver.find(
      "Sign In, black button below the password field",
    );
    await signInButton.click();

    const result = await testdriver.assert(
      "an error shows that fields are required",
    );
    expect(result).toBeTruthy();
  });
});
```

### Example 3: Type and Submit
*From: `test/testdriver/type.test.mjs`*

```javascript
import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/vitest/hooks";

describe("Type Test", () => {
  it("should enter standard_user in username field", async (context) => {
    const testdriver = TestDriver(context, { headless: true });
    
    await testdriver.provision.chrome({ 
      url: 'http://testdriver-sandbox.vercel.app/login' 
    });

    const usernameField = await testdriver.find(
      "Username, input field for username",
    );
    await usernameField.click();
    await testdriver.type("standard_user");

    const result = await testdriver.assert(
      'the username field contains "standard_user"',
    );
    expect(result).toBeTruthy();
  });
});
```

### Example 4: Keyboard Shortcuts
*From: `test/testdriver/press-keys.test.mjs`*

```javascript
import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/vitest/hooks";

describe("Press Keys Test", () => {
  it("should navigate using keyboard shortcuts", async (context) => {
    const testdriver = TestDriver(context, { headless: true });
    
    await testdriver.provision.chrome({ 
      url: 'http://testdriver-sandbox.vercel.app/login' 
    });

    // Open new tab
    await testdriver.pressKeys(["ctrl", "t"]);

    // Open DevTools
    await testdriver.pressKeys(["ctrl", "shift", "i"]);

    // Navigate to Google
    await testdriver.type("google.com");
    await testdriver.pressKeys(["enter"]);

    const result = await testdriver.assert("google appears");
    expect(result).toBeTruthy();
  });
});
```

---

## Best Practices for AI Agents

### ✅ DO: Use Interactions for Tests

**Prefer** `find()`, `click()`, `type()`, `assert()` over low-level methods:

```javascript
// ✅ Good - Natural, readable
await testdriver.find('submit button').click();
await testdriver.assert('form submitted successfully');

// ❌ Avoid - Too low-level
await testdriver.click(682, 189);
```

### ✅ DO: Use Descriptive Element Descriptions

```javascript
// ✅ Good
await testdriver.find('blue submit button below password field');

// ❌ Bad
await testdriver.find('button');
```

### ✅ DO: Take Screenshots When Debugging

```javascript
// ✅ Good
const screenshot = await testdriver.screenshot();
console.log(`Debug screenshot: ${screenshot.path}`);
```

### ✅ DO: Check Debug Info from find()

```javascript
// ✅ Good
const button = await testdriver.find('submit');
console.log(`Found at (${button.x}, ${button.y})`);
console.log(`Similarity: ${button.similarity}`);
console.log(`Strategy: ${button.strategy}`);
```

### ✅ DO: Use reconnect for Iteration

```javascript
// ✅ Good - Comment out working steps, use reconnect: true
const testdriver = TestDriver(context, { 
  headless: true,
  reconnect: true 
});

// await testdriver.provision.chrome({ url: 'https://example.com' });
// await testdriver.find('login').click();

// Only run new code
await testdriver.find('submit').click();
```

### ✅ DO: Prefer Linux Sandboxes

```javascript
// ✅ Good - Faster and cheaper
const testdriver = TestDriver(context, { headless: true });

// ❌ Only use if necessary
const testdriver = TestDriver(context, { 
  headless: true, 
  platform: 'windows' 
});
```

### ❌ DON'T: Forget to Provision

```javascript
// ❌ Bad - Sandbox is empty!
const testdriver = TestDriver(context);
await testdriver.find('button').click(); // Will fail

// ✅ Good - Provision first
const testdriver = TestDriver(context);
await testdriver.provision.chrome({ url: 'https://example.com' });
await testdriver.find('button').click();
```

### ❌ DON'T: Use Hardcoded Coordinates

```javascript
// ❌ Bad - Brittle
await testdriver.click(682, 189);

// ✅ Good - Flexible
const button = await testdriver.find('submit button');
await button.click();
```

---

## Configuration Options

### TestDriver Constructor Options

```javascript
TestDriver(context, {
  headless: true,           // Headless mode (default: false)
  platform: 'linux',        // Platform: 'linux' or 'windows'
  reconnect: true,          // Reconnect to existing sandbox (default: false)
  cacheKey: 'my-test',      // Cache key for element caching
  apiKey: 'tdai-xxx',       // API key (or use TD_API_KEY env var)
});
```

### Environment Variables

```bash
# Required
TD_API_KEY=tdai-1234567890abcdef

# Optional
VERBOSE=true               # Enable verbose logging
```

---

## Additional Resources

### Documentation

All guides are in the `docs/v7/` directory:

- **Getting Started**
  - `getting-started/installation.mdx` - Installation guide
  - `getting-started/quickstart.mdx` - Quick start tutorial
  - `getting-started/configuration.mdx` - Configuration options
  - `getting-started/writing-tests.mdx` - Writing tests guide
  - `getting-started/running-and-debugging.mdx` - Debugging guide
  - `getting-started/setting-up-in-ci.mdx` - CI/CD setup

- **Features**
  - Various feature guides in `features/` directory

- **API Reference**
  - `api/` - Complete API documentation

- **Platforms**
  - `platforms/` - Platform-specific guides

### Example Tests

Browse `test/testdriver/` for comprehensive examples:

- `assert.test.mjs` - Assertions
- `hover-text.test.mjs` - Hovering
- `type.test.mjs` - Typing text
- `press-keys.test.mjs` - Keyboard shortcuts
- `scroll.test.mjs` - Scrolling
- `drag-and-drop.test.mjs` - Drag and drop
- `focus-window.test.mjs` - Window focusing
- And many more...

---

## Quick Reference Card

```javascript
// Setup
import { test } from 'vitest';
import { TestDriver } from 'testdriverai/vitest/hooks';

test('test name', async (context) => {
  const testdriver = TestDriver(context, { headless: true });
  
  // Provision
  await testdriver.provision.chrome({ url: 'https://example.com' });
  
  // Find elements
  const element = await testdriver.find('description');
  
  // Interact
  await element.click();
  await element.hover();
  await testdriver.type('text');
  await testdriver.pressKeys(['ctrl', 't']);
  await testdriver.scroll('down', 3);
  
  // Assert
  await testdriver.assert('expected state');
  
  // Debug
  await testdriver.screenshot();
  console.log(element.x, element.y, element.similarity);
});
```

---

## Summary for AI Agents

1. **Initialize**: Run `npx testdriverai init` to set up projects
2. **API Key**: Get from console.testdriver.ai/team, set TD_API_KEY in .env
3. **Provision**: Always provision sandboxes (use `provision.chrome()`)
4. **Prefer Linux**: Faster and cheaper than Windows
5. **Use find()**: Natural language element finding with rich debug info
6. **Take Screenshots**: Essential for debugging (`screenshot()`)
7. **Use reconnect: true**: Comment out working code, iterate on failing steps
8. **Be Descriptive**: Detailed element descriptions work better
9. **Check Examples**: `test/testdriver/*.test.mjs` has many patterns
10. **Read Docs**: `docs/v7/` has comprehensive guides

**You now have everything needed to autonomously write, debug, and execute TestDriver tests!** 🚀
