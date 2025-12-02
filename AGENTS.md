# TestDriver Agent Instructions

This guide teaches AI agents how to write modular, iteratively-debuggable Vitest tests using the TestDriver SDK.

## Core Principles

### 1. One Action Per Step

Each `it()` block performs exactly **ONE state-changing action** plus optional assertions.

**State-changing actions:**
- `click()` - clicking on elements
- `type()` - typing text
- `pressKeys()` - keyboard shortcuts
- `scroll()` - scrolling the page

**NOT state-changing (can combine with actions):**
- `find()` - locating elements
- `assert()` - verifying state
- `exists()` - checking element presence
- `screenshot()` - capturing screen

```javascript
// ✅ CORRECT: One action per step
it("step01: click the login button", async () => {
  const button = await testdriver.find("Login button");
  await button.click();
  // Optional: verify the action worked
  const form = await testdriver.find("Login form");
  expect(form.exists()).toBe(true);
});

it("step02: type username", async () => {
  await testdriver.type("testuser");
  await testdriver.assert("username field contains 'testuser'");
});

// ❌ WRONG: Multiple actions in one step
it("login flow", async () => {
  await testdriver.find("Login").click();
  await testdriver.type("user");     // second action!
  await testdriver.type("password"); // third action!
  await testdriver.find("Submit").click(); // fourth action!
});
```

### 2. Step Naming Convention

Use zero-padded step numbers for proper sorting and easy `--testNamePattern` filtering:

```javascript
it("step01: open application", async () => { ... });
it("step02: click login button", async () => { ... });
it("step03: enter username", async () => { ... });
it("step04: enter password", async () => { ... });
it("step05: submit form", async () => { ... });
it("step06: verify dashboard loaded", async () => { ... });
```

### 3. All Steps in One File

Write all steps for a test flow in the same file. This allows:
- Running the entire flow: `vitest path/to/test.test.js`
- Debugging a single step: `vitest --testNamePattern "step03"`

### 4. Steps Run Sequentially, Not in Parallel

**CRITICAL:** Steps must execute in sequence, one after another. Each step depends on the state left by the previous step.

```javascript
// ✅ CORRECT: Steps run in order, each building on the previous state
it("step01: click login button", async () => { ... });  // First
it("step02: type username", async () => { ... });       // Second (form is now open)
it("step03: type password", async () => { ... });       // Third (username is filled)
it("step04: submit form", async () => { ... });         // Fourth (credentials entered)

// ❌ WRONG: Running steps in parallel breaks the test
// Step 2 needs the form open (from step 1)
// Step 3 needs username entered (from step 2)
// Steps cannot run simultaneously!
```

**Why sequential execution matters:**
- The sandbox maintains state between steps
- Each step assumes the previous step completed successfully
- UI state (open modals, filled forms, navigation) carries forward
- Parallel execution would cause race conditions and undefined behavior

**Vitest configuration:** Ensure your `vitest.config.js` does NOT run tests in parallel:

```javascript
export default {
  test: {
    sequence: {
      concurrent: false,  // Steps run one at a time
    },
    testTimeout: 120000,
  },
};
```

### 5. Optional Assertions

Assertions verify the action worked. Use them when appropriate:

```javascript
// After clicking - verify navigation or state change
it("step01: click submit button", async () => {
  await testdriver.find("Submit button").click();
  await testdriver.assert("form was submitted successfully");
});

// After typing - verify text appeared (optional, typing is deterministic)
it("step02: type search query", async () => {
  await testdriver.type("search term");
  // assertion optional for typing
});

// Use exists() for element presence
it("step03: verify modal appeared", async () => {
  const modal = await testdriver.find("Confirmation modal");
  expect(modal.exists()).toBe(true);
});
```

## Test Structure

### Basic Template

```javascript
import { describe, it, expect } from "vitest";
import { TestDriver } from "testdriverai/vitest";

describe("Feature Name", () => {
  it("step01: provision and first action", async (context) => {
    const testdriver = TestDriver(context);
    await testdriver.provision.chrome({ url: 'https://example.com' });
    
    // First action + optional assertion
  });

  it("step02: second action", async (context) => {
    const testdriver = TestDriver(context);
    
    // action + optional assertion
  });
});
```

**Key Points:**
- Each test gets its own `testdriver` via `TestDriver(context)`
- Call `provision.chrome({ url })` in the first step to launch the browser
- Subsequent steps don't need to provision - the sandbox persists

## Shared Helpers

### Reusing Common Flows

Before writing steps for common flows (login, navigation, setup), check if a helper already exists.

**Helper Location:** `testdriver/helpers/`

### Creating a Helper

```javascript
// testdriver/helpers/login.js
export async function login(testdriver, username = "testuser", password = "password") {
  const loginButton = await testdriver.find("Login button");
  await loginButton.click();
  
  await testdriver.type(username);
  await testdriver.pressKeys(["Tab"]);
  await testdriver.type(password);
  
  const submitButton = await testdriver.find("Submit button");
  await submitButton.click();
  
  await testdriver.assert("user is logged in");
}
```

### Using a Helper

```javascript
import { describe, it, expect } from "vitest";
import { TestDriver } from "testdriverai/vitest";
import { login } from "./helpers/login.js";

describe("Dashboard Tests", () => {
  it("step01: provision and login", async (context) => {
    const testdriver = TestDriver(context);
    await testdriver.provision.chrome({ url: 'https://example.com' });
    await login(testdriver);
  });

  it("step02: navigate to settings", async (context) => {
    const testdriver = TestDriver(context);
    const settingsLink = await testdriver.find("Settings link in sidebar");
    await settingsLink.click();
  });

  // ... more steps
});
```

### When to Create Helpers

Create a helper when:
- Flow is used in multiple tests (login, logout, navigation)
- Flow has 3+ steps that are always done together
- Flow requires specific credentials or configuration

## Iterative Development Workflow

**CRITICAL: Write and run tests ONE STEP AT A TIME.** Do not write the entire test file upfront. Build it incrementally.

### The Loop

```
┌─────────────────────────────────────────────────────────┐
│  1. Write ONE step                                      │
│  2. Run that step: vitest --testNamePattern "stepNN"    │
│  3. Did it pass?                                        │
│     ├─ YES → Go to step 1, write next step              │
│     └─ NO  → Fix the step, go to step 2                 │
│  4. When all steps pass, run entire file                │
└─────────────────────────────────────────────────────────┘
```

### Detailed Workflow

#### Phase 1: Setup the Test File

Create the file with the describe block and NO steps yet:

```javascript
import { describe, it, expect } from "vitest";
import { TestDriver } from "testdriverai/vitest";

describe("My Feature Test", () => {
  // Steps will be added one at a time below
});
```

#### Phase 2: Write Step 1

Add the first step with provisioning:

```javascript
  it("step01: open app and click login", async (context) => {
    const testdriver = TestDriver(context);
    await testdriver.provision.chrome({ url: 'https://example.com/login' });
    
    const button = await testdriver.find("Login button in the header");
    await button.click();
  });
```

#### Phase 3: Run Step 1

```bash
vitest --testNamePattern "step01" path/to/test.test.js
```

**If it passes:** Move to Phase 4.

**If it fails:** 
- Check the error message
- Take a screenshot to see actual screen state
- Common fixes:
  - Improve the `find()` description (be more specific)
  - The element might not be visible yet (add scroll or wait)
  - Wrong element clicked (check coordinates)
- Edit the step and re-run the same command

#### Phase 4: Write Step 2

Only after step 1 passes, add step 2:

```javascript
  it("step02: type username", async (context) => {
    const testdriver = TestDriver(context);
    await testdriver.type("testuser");
  });
```

#### Phase 5: Run Step 2

```bash
vitest --testNamePattern "step02" path/to/test.test.js
```

The sandbox persists from step 1, so the app is already in the right state.

**If it passes:** Continue to step 3.

**If it fails:** Fix and re-run step 2 only.

#### Phase 6: Repeat

Continue this pattern:
1. Write step N
2. Run step N
3. Fix until passing
4. Write step N+1

#### Phase 7: Run Full Test

When all steps pass individually:

```bash
vitest path/to/test.test.js
```

This runs all steps in sequence to verify the complete flow.

### Why One Step at a Time?

1. **Faster debugging** - If step 5 fails, you only re-run step 5, not steps 1-4
2. **Sandbox reuse** - The sandbox persists, so previous steps don't need to re-run
3. **Immediate feedback** - You see if each action works before moving on
4. **Easier fixes** - Smaller changes are easier to debug

### Example: Building a Test Incrementally

**Goal:** Test user login

**Iteration 1:** Write and run step01
```javascript
it("step01: provision and click login", async (context) => {
  const testdriver = TestDriver(context);
  await testdriver.provision.chrome({ url: 'https://example.com' });
  
  const button = await testdriver.find("Login button");
  await button.click();
});
```
```bash
vitest --testNamePattern "step01" login.test.js
# ✅ Passed
```

**Iteration 2:** Write and run step02
```javascript
it("step02: type username", async (context) => {
  const testdriver = TestDriver(context);
  await testdriver.type("admin");
});
```
```bash
vitest --testNamePattern "step02" login.test.js
# ❌ Failed - typing into wrong field
```

**Iteration 2b:** Fix step02 - need to click the field first
```javascript
it("step02: click username field", async (context) => {
  const testdriver = TestDriver(context);
  const field = await testdriver.find("Username input field");
  await field.click();
});
```
```bash
vitest --testNamePattern "step02" login.test.js
# ✅ Passed
```

**Iteration 3:** Write and run step03
```javascript
it("step03: type username", async (context) => {
  const testdriver = TestDriver(context);
  await testdriver.type("admin");
});
```
```bash
vitest --testNamePattern "step03" login.test.js
# ✅ Passed
```

Continue until complete...

## Sandbox Persistence

TestDriver automatically persists sandbox connections:

- **Project-local:** `.testdriver-sandbox.json` in current directory
- **Timeout:** 10 minutes of inactivity
- **Auto-reconnect:** Automatically reuses recent sandbox on next run

During development:
- Don't call `disconnect()` in `afterAll`
- Sandbox stays alive between test runs
- If sandbox expires, a new one is created automatically

### One-Time Setup Steps

Use `it.once()` for steps that should only run once per sandbox session (app launch, provisioning):

```javascript
import { describe, it, beforeAll, expect } from "testdriverai/vitest";
import TestDriver from "testdriverai";

describe("My Test", () => {
  let testdriver;

  beforeAll(async () => {
    testdriver = new TestDriver(process.env.TD_API_KEY);
    await testdriver.connect();
    
    // Store globally so it.once() can check isReconnected
    globalThis.__testdriver = testdriver;
  });

  // Only runs once per sandbox session - skipped on reconnect
  it.once("launch the application", async () => {
    await testdriver.exec("sh", "google-chrome https://example.com", 5000);
    await testdriver.assert("application is loaded");
  });

  // Always runs
  it("click the login button", async () => {
    const button = await testdriver.find("Login button");
    await button.click();
  });

  // Always runs  
  it("type username", async () => {
    await testdriver.type("testuser");
  });
});
```

**When to use `it.once()`:**
- Launching the application
- Navigating to initial URL
- One-time provisioning steps
- Any step that sets up state that persists in the sandbox

**Regular `it()` steps:**
- All subsequent actions
- Steps you're actively developing/debugging

This lets you run the full file and one-time steps are automatically skipped on reconnect:
```bash
# First run: setup runs, then all steps
vitest path/to/test.test.js

# Second run (within 10 min): setup skipped, runs from first regular step
vitest path/to/test.test.js
```

**How it works:**
- The SDK sets `testdriver.isReconnected = true` when it reconnects to an existing sandbox
- `it.once()` checks `globalThis.__testdriver.isReconnected` to decide whether to skip

## SDK Quick Reference

### Finding Elements

```javascript
// Find returns an Element with coordinates
const element = await testdriver.find("description of element");

// Chain directly
await testdriver.find("Submit button").click();

// Check if found
if (element.exists()) { ... }

// Get coordinates
const { x, y, centerX, centerY } = element.getCoordinates();
```

### Actions

```javascript
// Click (on found element)
await element.click();
await element.click("double-click");
await element.click("right-click");

// Type text (into focused field)
await testdriver.type("text to type");
await testdriver.type("text", 100); // with delay between keys

// Keyboard shortcuts
await testdriver.pressKeys(["ctrl", "c"]);
await testdriver.pressKeys(["cmd", "shift", "p"]);

// Scroll
await testdriver.scroll("down", 300);
await testdriver.scroll("up", 500, "keyboard");
```

### Verification

```javascript
// AI-powered assertion (flexible, visual)
const passed = await testdriver.assert("the form was submitted successfully");
expect(passed).toBe(true);

// Element existence
const element = await testdriver.find("Success message");
expect(element.exists()).toBe(true);

// Screenshot for debugging
const screenshot = await testdriver.screenshot();
```

### Remember (Extract Values)

```javascript
// Extract dynamic values from screen
const orderNumber = await testdriver.remember("the order confirmation number");
console.log("Order:", orderNumber);
```

## Example: Complete Test File

```javascript
import { describe, it, expect } from "vitest";
import { TestDriver } from "testdriverai/vitest";

describe("User Registration", () => {
  it("step01: provision and navigate to registration", async (context) => {
    const testdriver = TestDriver(context);
    await testdriver.provision.chrome({ url: 'https://example.com' });
    
    const signupLink = await testdriver.find("Sign Up link in navigation");
    await signupLink.click();
    await testdriver.assert("registration form is visible");
  });

  it("step02: enter email address", async (context) => {
    const testdriver = TestDriver(context);
    const emailField = await testdriver.find("Email input field");
    await emailField.click();
    await testdriver.type("test@example.com");
  });

  it("step03: enter password", async (context) => {
    const testdriver = TestDriver(context);
    const passwordField = await testdriver.find("Password input field");
    await passwordField.click();
    await testdriver.type("SecurePass123!");
  });

  it("step04: confirm password", async (context) => {
    const testdriver = TestDriver(context);
    const confirmField = await testdriver.find("Confirm password field");
    await confirmField.click();
    await testdriver.type("SecurePass123!");
  });

  it("step05: accept terms and conditions", async (context) => {
    const testdriver = TestDriver(context);
    const checkbox = await testdriver.find("Terms and conditions checkbox");
    await checkbox.click();
  });

  it("step06: submit registration", async (context) => {
    const testdriver = TestDriver(context);
    const submitButton = await testdriver.find("Create Account button");
    await submitButton.click();
    await testdriver.assert("account was created successfully");
  });

  it("step07: verify welcome message", async (context) => {
    const testdriver = TestDriver(context);
    const welcome = await testdriver.find("Welcome message");
    expect(welcome.exists()).toBe(true);
  });
});
```

## Tips for AI Agents

1. **Write ONE step at a time** - Never write the full test upfront. Write step 1, run it, fix it, then write step 2.
2. **Run after each step** - Use `vitest --testNamePattern "stepNN"` to test each step immediately
3. **Search before writing** - Check `testdriver/helpers/` for existing flows
4. **Descriptive find()** - Include location, color, text: "blue Submit button below the form"
5. **One action at a time** - Easier to debug when things fail
6. **Assert after important actions** - Especially navigation and form submissions
7. **Use step numbers** - Makes `--testNamePattern` filtering easy
8. **Don't disconnect during dev** - Let sandbox persist for faster iteration
9. **Check screenshots** - When steps fail, look at actual screen state
