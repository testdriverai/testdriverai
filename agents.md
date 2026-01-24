# TestDriver Agent Guide

This guide is designed for AI agents working with TestDriver. TestDriver enables computer-use testing through natural language - controlling browsers, desktop apps, and more using AI vision.

## Quick Reference

| Resource | Location |
|----------|----------|
| Code samples | `node_modules/testdriverai/test` |
| TypeScript types | `node_modules/testdriverai/sdk.d.ts` |
| Documentation | `node_modules/testdriverai/docs` |
| API Key | [console.testdriver.ai/team](https://console.testdriver.ai/team) |

## Prerequisites

### API Key Setup

The user **must** have a TestDriver API key set in their environment:

```bash
# .env file
TD_API_KEY=your_api_key_here
```

Get your API key at: **https://console.testdriver.ai/team**

### Test Runner

TestDriver **only works with Vitest**. Tests must use the `.test.mjs` extension and import from vitest:

```javascript
import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/lib/vitest/hooks.mjs";
```

## Basic Test Structure

```javascript
import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/lib/vitest/hooks.mjs";

describe("My Test Suite", () => {
  it("should do something", async (context) => {
    // Initialize TestDriver
    const testdriver = TestDriver(context);
    
    // Start with provision - this launches the sandbox and browser
    await testdriver.provision.chrome({
      url: 'https://example.com',
    });

    // Find elements and interact
    const button = await testdriver.find("Sign In button");
    await button.click();

    // Assert using natural language
    const result = await testdriver.assert("the dashboard is visible");
    expect(result).toBeTruthy();
  });
});
```

## Provisioning Options

Most tests start with `testdriver.provision`. Choose the right one:

### `provision.chrome` - Web Testing (Most Common)
```javascript
await testdriver.provision.chrome({
  url: 'https://your-app.com',
});
```

### `provision.installer` - Desktop App Testing
```javascript
// Download and install an application
const filePath = await testdriver.provision.installer({
  url: 'https://example.com/app.deb',  // or .msi, .exe, .sh
  launch: true,  // auto-launch after install
});
```

## Key SDK Methods

The SDK has TypeScript types in `sdk.d.ts`. Key methods:

| Method | Purpose |
|--------|---------|
| `find(description)` | Find element by natural language |
| `findAll(description)` | Find all matching elements |
| `assert(assertion)` | AI-powered assertion || `screenshot()` | Capture and save screenshot locally || `type(text)` | Type text |
| `pressKeys([keys])` | Press keyboard keys |
| `scroll(direction)` | Scroll the page |
| `exec(language, code)` | Execute code in sandbox |
| `screenshot(scale, silent, mouse)` | Capture screenshot as base64 PNG |
| `ai(task)` | AI exploratory loop (see note below) |

### About `ai()` - Use for Exploration, Not Final Tests

The `ai(task)` method lets the AI figure out how to accomplish a task autonomously. It's useful for:
- **Exploring** how to accomplish something when you're unsure of the steps
- **Discovering** element descriptions and UI flow
- **Last resort** when explicit methods fail repeatedly

However, **prefer explicit methods** (`find`, `click`, `type`) in final tests because:
- They're more predictable and repeatable
- They're faster (no AI reasoning loop)
- They're easier to debug when they fail

```javascript
// ✅ GOOD: Explicit steps (preferred for final tests)
const emailInput = await testdriver.find("email input field");
await emailInput.click();
await testdriver.type("user@example.com");

// ⚠️ OK for exploration, but convert to explicit steps later
await testdriver.ai("fill in the email field with user@example.com");
```

### Element Properties (for debugging)

Elements returned by `find()` have properties you can inspect:

```javascript
const element = await testdriver.find("Sign In button");

// Debugging properties
console.log(element.x, element.y);           // coordinates
console.log(element.centerX, element.centerY); // center coordinates  
console.log(element.width, element.height);  // dimensions
console.log(element.confidence);             // AI confidence score
console.log(element.text);                   // detected text
console.log(element.boundingBox);            // full bounding box
```

### Element Methods

```javascript
const element = await testdriver.find("button");
await element.click();        // click
await element.hover();        // hover
await element.doubleClick();  // double-click
await element.rightClick();   // right-click
await element.mouseDown();    // press mouse down
await element.mouseUp();      // release mouse
element.found();              // check if found (boolean)
```

### Screenshots for Debugging

**Use `screenshot()` liberally during development** to see exactly what the sandbox screen looks like. Screenshots are saved locally and organized by test file.

```javascript
// Capture a screenshot - saved to .testdriverai/screenshots/<test-file>/
const screenshotPath = await testdriver.screenshot();
console.log('Screenshot saved to:', screenshotPath);

// Include mouse cursor in screenshot
await testdriver.screenshot(1, false, true);
```

**When to use screenshots:**
- After `provision.chrome()` to verify the page loaded correctly
- Before/after clicking elements to see state changes
- When a `find()` fails to see what the AI is actually seeing
- Before `assert()` calls to debug assertion failures
- When tests behave unexpectedly

**Screenshot file organization:**
```
.testdriverai/
  screenshots/
    login.test/           # Folder per test file
      screenshot-1737633600000.png
      screenshot-1737633605000.png
    checkout.test/
      screenshot-1737633700000.png
```

> **Note:** The screenshot folder for each test file is automatically cleared when the test starts, so you only see screenshots from the most recent run.

## Best Workflow: Two-File Pattern

**The most efficient workflow for building tests uses two files.** This prevents having to restart from scratch when experimenting with new steps.

### IMPORTANT: When to Use This Pattern

- **If a working test already exists**: Only create an `experiment.test.mjs` file to add new steps. Do NOT recreate the stable file.
- **If starting from scratch**: Start with a MINIMAL setup file, run it, verify it passes, THEN create the experiment file.

### Step 1: Create a Minimal Setup File

Start with the bare minimum - just provision and one assertion. **Do NOT call it "stable" yet** - name it `setup.test.mjs` until it's proven to work:

```javascript
/**
 * Setup file - MINIMAL steps to get to starting state
 * Only add more steps AFTER this passes!
 */
import { afterAll, describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/lib/vitest/hooks.mjs";

describe("Setup State", () => {

  afterAll(async () => {
    // DO NOT disconnect - keep sandbox alive for reconnect
    console.log("Sandbox staying alive for 30 seconds (keepAlive)");
  });

  it("should set up the application state", async (context) => {
    const testdriver = TestDriver(context);
    
    await testdriver.provision.chrome({
      url: 'https://your-app.com/login',
    });

    // Start with just ONE assertion to verify we're on the right page
    const result = await testdriver.assert("I can see the login page");
    expect(result).toBeTruthy();
    
    console.log("✅ Setup ready - run experiment.test.mjs now");
  });
});
```

### Step 2: Run Setup File and Verify It Passes

```bash
vitest run tests/setup.test.mjs
```

**Only proceed to Step 3 if this passes!** If it fails, fix it first.

### Step 3: Create Experiment File

Only AFTER the setup file passes, create the experiment file.

**CRITICAL: The experiment file must NOT call `provision`!** It reconnects to the existing sandbox where provision already ran:

```javascript
/**
 * Experiment file - reconnects to existing sandbox
 * Run AFTER setup.test.mjs passes (within 2 minutes)
 */
import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/lib/vitest/hooks.mjs";

describe("Experiment", () => {

  it("should continue from existing state", async (context) => {
    const testdriver = TestDriver(context, { 
      reconnect: true  // ← Key: reconnects to last sandbox
    });
    
    // NO provision here! The sandbox is already running from setup.test.mjs
    
    // Experiment with new steps here - try ONE thing at a time
    const element = await testdriver.find("email input");
    console.log("Found element:", element.found(), element.getCoordinates());
    
    await element.click();
    await testdriver.type("user@example.com");
    
    // Assert after each major step
    const result = await testdriver.assert("email is filled in");
    console.log("Assertion result:", result);
    expect(result).toBeTruthy();
  });
});
```

> ⚠️ **NEVER REMOVE `reconnect: true`**: If a test file already has `reconnect: true`, do NOT remove it. This option is intentional and removing it will break the two-file workflow. Only remove `reconnect: true` when explicitly combining files into a final standalone test.

### Step 4: Iterate in Experiment File

- Run experiment, see output, fix issues
- Once steps work, move them to the setup file
- Re-run setup file to verify it still passes
- Repeat until complete

### Running the Two-File Pattern

```bash
# Step 1: Run setup file (must pass first!)
vitest run tests/setup.test.mjs

# Step 2: Within 2 minutes, run experiment file
vitest run tests/experiment.test.mjs
```

### After Experimentation: Combine and Rename

**IMPORTANT:** Once the test is working AND the user explicitly asks to combine/finalize the test, combine both files into a single, properly-named test file:

1. **Merge the code** - Copy the working steps from `experiment.test.mjs` into `setup.test.mjs`
2. **Remove reconnect options** - Delete `reconnect: true` since the final test runs standalone (ONLY do this when creating the final combined test - never remove it from an existing experiment file!)
3. **Rename the file** - Give it a meaningful name like `login-flow.test.mjs` or `checkout-process.test.mjs`
4. **Delete the experiment file** - Clean up `experiment.test.mjs`

> ⚠️ **WARNING FOR AI AGENTS**: Do NOT remove `reconnect: true` from any existing test file unless you are explicitly combining files into a final test. If a test has `reconnect: true`, it is there intentionally.

```javascript
// Final combined test: login-flow.test.mjs
import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/lib/vitest/hooks.mjs";

describe("Login Flow", () => {
  it("should log in and open settings", async (context) => {
    const testdriver = TestDriver(context);
    
    await testdriver.provision.chrome({ url: 'https://your-app.com/login' });

    // Steps from stable file
    await testdriver.find("email input").click();
    await testdriver.type("user@example.com");
    await testdriver.find("password input").click();
    await testdriver.type("password123");
    await testdriver.find("Login button").click();
    
    // Steps from experiment file
    const settingsBtn = await testdriver.find("Settings button");
    await settingsBtn.click();
    
    const result = await testdriver.assert("Settings panel is open");
    expect(result).toBeTruthy();
  });
});
```

## Recommended Development Workflow

1. **Write a few steps** - Don't write the entire test at once
2. **Run the test** - See what happens on the sandbox
3. **Inspect outputs** - Use element properties to debug
4. **Assert/expect** - Verify the step worked
5. **Iterate** - Add more steps incrementally

```javascript
// Development workflow example
it("should incrementally build test", async (context) => {
  const testdriver = TestDriver(context);
  await testdriver.provision.chrome({ url: 'https://example.com' });

  // Take a screenshot to see the initial state
  await testdriver.screenshot();

  // Step 1: Find and inspect
  const element = await testdriver.find("Some button");
  console.log("Element found:", element.found());
  console.log("Coordinates:", element.x, element.y);
  console.log("Confidence:", element.confidence);
  
  // Step 2: Interact
  await element.click();
  
  // Screenshot after interaction to see the result
  await testdriver.screenshot();
  
  // Step 3: Assert and log
  const result = await testdriver.assert("Something happened");
  console.log("Assertion result:", result);
  expect(result).toBeTruthy();
  
  // Then add more steps...
});
```

## TestDriver Options Reference

```javascript
const testdriver = TestDriver(context, {
  newSandbox: true,       // Create new sandbox (default: true)
  headless: false,        // Run in headless mode (default: false)
  reconnect: false,       // Reconnect to last sandbox (default: false)
  keepAlive: 30000,       // Keep sandbox alive after test (default: 30000ms / 30 seconds)
  os: 'linux',            // 'linux' | 'windows' (default: 'linux')
  resolution: '1366x768', // Sandbox resolution
  cache: true,            // Enable element caching (default: true)
  cacheKey: 'my-test',    // Cache key for element finding
});
```

## Common Patterns

### Typing in Fields
```javascript
await testdriver.find("Email input").click();
await testdriver.type("user@example.com");
```

### Keyboard Shortcuts
```javascript
await testdriver.pressKeys(["ctrl", "a"]);  // Select all
await testdriver.pressKeys(["ctrl", "c"]);  // Copy
await testdriver.pressKeys(["enter"]);       // Submit
```

### Waiting and Polling
```javascript
// Use timeout option to poll until element is found (retries every 5 seconds)
const element = await testdriver.find("Loading complete indicator", { timeout: 30000 });
await element.click();
```

### Scrolling
```javascript
await testdriver.scroll("down");
await testdriver.scrollUntilText("Footer text");
await testdriver.scrollUntilImage("Product image at bottom");
```

### Executing Code in Sandbox
```javascript
// JavaScript
const result = await testdriver.exec("js", "return document.title", 5000);

// Shell (Linux)
const output = await testdriver.exec("sh", "ls -la", 5000);

// PowerShell (Windows)
const date = await testdriver.exec("pwsh", "Get-Date", 5000);
```

### Capturing Screenshots
```javascript
// Capture a screenshot and save to file
const screenshot = await testdriver.screenshot();
const filepath = 'screenshot.png';
fs.writeFileSync(filepath, Buffer.from(screenshot, 'base64'));
console.log('Screenshot saved to:', filepath);

// Capture with mouse cursor visible
const screenshotWithMouse = await testdriver.screenshot(1, false, true);
fs.writeFileSync('screenshot-with-mouse.png', Buffer.from(screenshotWithMouse, 'base64'));
console.log('Screenshot with mouse saved to: screenshot-with-mouse.png');
```

## Tips for Agents

1. **Always check `sdk.d.ts`** for method signatures and types
2. **Look at test samples** in `node_modules/testdriverai/test` for working examples
3. **Use reconnect pattern** when iterating on test steps
4. **Log element properties** to understand what the AI sees
5. **Use `assert()` with specific, descriptive natural language**
6. **Start simple** - get one step working before adding more
7. **Take screenshots liberally** - use `await testdriver.screenshot()` after key steps to debug what the sandbox actually shows. Check `.testdriverai/screenshots/<test-file>/` to review them.
8. **Always `await` async methods** - TestDriver will warn if you forget, but for TypeScript projects, add `@typescript-eslint/no-floating-promises` to your ESLint config to catch missing `await` at compile time:
   ```json
   // eslint.config.js (for TypeScript projects)
   {
     "rules": {
       "@typescript-eslint/no-floating-promises": "error"
     }
   }
   ```
