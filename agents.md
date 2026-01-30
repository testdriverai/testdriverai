# TestDriver Agent Guide

This guide is designed for AI agents working with TestDriver. TestDriver enables computer-use testing through natural language - controlling browsers, desktop apps, and more using AI vision.

## Quick Reference

| Resource         | Location                                                         |
| ---------------- | ---------------------------------------------------------------- |
| Code samples     | `node_modules/testdriverai/test`                                 |
| TypeScript types | `node_modules/testdriverai/sdk.d.ts`                             |
| Documentation    | `node_modules/testdriverai/docs`                                 |
| API Key          | [console.testdriver.ai/team](https://console.testdriver.ai/team) |

## MCP Workflow

Use the TestDriver MCP tools to build tests interactively with visual feedback:

1. **Start session**: `session_start({ type: "chrome", url: "https://your-app.com" })`
2. **Interact**: Use `find`, `click`, `type` - each returns a screenshot AND generated code
3. **Append code**: After each successful action, append the generated code to your test file
4. **Check**: Use `check` after actions to verify if the task completed successfully (FOR YOUR UNDERSTANDING ONLY - does NOT generate test code)
5. **Assert**: Use `assert` for specific boolean pass/fail conditions (GENERATES CODE for the test file)
6. **Verify test**: Use `verify` to run the test from scratch to validate

**Key advantages:**
- **Generated code included in every response** - just append to your test file
- Use `check` to get AI analysis of whether actions succeeded
- No need to re-run the entire test for each change
- Full control over where code is inserted in existing test files
- O(1) iteration time regardless of test length

See the `testdriver:mcp-workflow` skill for detailed documentation.

## Prerequisites

### API Key Setup

The user **must** have a TestDriver API key set in their environment:

```bash
# .env file
TD_API_KEY=your_api_key_here
```

Get your API key at: **https://console.testdriver.ai/team**

## MCP Tools Reference

### Session Management

| Tool | Description |
|------|-------------|
| `session_start` | Start sandbox with browser/app, returns initial screenshot + provision code |
| `session_status` | Check session health and time remaining |
| `session_extend` | Add more time before session expires |

### Element Interaction

Each tool returns a screenshot AND the generated code to add to your test file.

| Tool | Description |
|------|-------------|
| `find` | Locate element by natural language description, returns ref for later use |
| `click` | Click on element ref |
| `find_and_click` | Find and click in one action |
| `type` | Type text into focused field |
| `press_keys` | Press keyboard shortcuts (e.g., `["ctrl", "a"]`) |
| `scroll` | Scroll page (up/down/left/right) |

### Verification & Display

| Tool | Description |
|------|-------------|
| `check` | **For AI to understand screen state ONLY.** Analyzes current screen and returns detailed feedback about whether a task/condition is met. Use this after actions to verify they worked. **DOES NOT generate code** - never appears in test files. |
| `assert` | AI-powered boolean assertion for test files (pass/fail). **GENERATES CODE** like `await testdriver.assert("...")` that gets recorded in the test file. Use this for verifications that should be in the final test. |
| `screenshot` | **Only use when the user explicitly asks to see the screen.** Captures and displays a screenshot. Does NOT return analysis to AI. |
| `exec` | Execute JavaScript, shell, or PowerShell in sandbox |

### Test Validation

| Tool | Description |
|------|-------------|
| `verify` | Run test file from scratch to validate it works |

## Workflow Example

```
# 1. Start a session
session_start({ type: "chrome", url: "https://app.example.com/login" })
→ Screenshot shows login page
→ Add to test file: await testdriver.provision.chrome({ url: "https://app.example.com/login" });

# 2. Fill in email
find_and_click({ description: "email input field" })
→ Screenshot shows cursor in email field
→ Add to test file: await testdriver.find("email input field").click();

type({ text: "user@example.com" })
→ Screenshot shows typed email
→ Add to test file: await testdriver.type("user@example.com");

# 3. Check if email was entered correctly (for your understanding - no code generated)
check({ task: "Was the email entered into the input field?" })
→ AI confirms email is visible in the field (this is for YOU, not the test file)

# 4. Fill in password
find_and_click({ description: "password input field" })
→ Add to test file: await testdriver.find("password input field").click();

type({ text: "secret123" })
→ Add to test file: await testdriver.type("secret123");

# 5. Submit login
find_and_click({ description: "Sign In button" })
→ Screenshot shows page changing
→ Add to test file: await testdriver.find("Sign In button").click();

# 6. Check if login succeeded (for your understanding - no code generated)
check({ task: "Did the login complete successfully?" })
→ AI analyzes screen and confirms dashboard is visible (this is for YOU, not the test file)

# 7. Assert success (THIS generates code for the test file)
assert({ assertion: "I can see the user dashboard" })
→ Pass with screenshot
→ Add to test file:
   const assertResult = await testdriver.assert("I can see the user dashboard");
   expect(assertResult).toBeTruthy();

# 8. Verify the test runs correctly
verify({ testFile: "tests/login.test.mjs" })
→ Test passes from scratch
```

## Visual Feedback

Action tools (`find`, `click`, `find_and_click`, etc.) return visual information showing:

- **Element highlights** - Blue box around found elements
- **Click markers** - Red dot with ripple effect at click location
- **Scroll indicators** - Arrow showing scroll direction
- **Action status** - Success/failure with duration
- **Session info** - Time remaining before expiry

**Important distinction:**
- Use `screenshot` **only when the user explicitly asks** to see the current screen state
- Use `check` for **AI to understand** the screen state (returns analysis) - **DOES NOT generate code**
- Use `assert` to **add verification to test file** - **GENERATES CODE** like `await testdriver.assert("...")`

## Best Practices

### 1. Work Incrementally

Don't try to build the entire test at once. After each action:
- Examine the screenshot
- Use `check` to verify the action worked
- Then proceed to the next step

### 2. Use Check vs Assert Appropriately

**`check`** - For YOUR understanding during development (DOES NOT generate code):
```
find_and_click({ description: "Submit button" })
check({ task: "Was the form submitted?" })
```
The `check` tool compares the previous screenshot with the current state and gives you AI analysis of whether your action succeeded. Use it to understand the screen state, but it will NOT appear in the generated test file.

**`assert`** - For verification steps in the test file (GENERATES CODE):
```
find_and_click({ description: "Submit button" })
assert({ assertion: "The form was submitted successfully" })
```
The `assert` tool generates code like `await testdriver.assert("...")` that gets added to the test file for CI/CD verification.

### 3. When to Use Each

- **Use `check`** when you need to understand what happened (debugging, verifying an action worked before continuing)
- **Use `assert`** when you want a verification step recorded in the final test file

### 3. Handle Timing Issues

If elements take time to appear, use `find` with timeout:

```
find({ description: "Loading complete indicator", timeout: 30000 })
```

### 4. Watch Session Time

Sessions expire after 5 minutes by default. Check with `session_status` and extend with `session_extend` if needed.

### 5. Write Code as You Go

After each successful action, append the generated code to your test file. This ensures you don't lose progress and makes the test easier to debug.

## Error Recovery

### Element Not Found

1. Check the screenshot to see what's actually on screen
2. Adjust the element description to be more specific
3. Use timeout: `find({ description: "...", timeout: 10000 })`
4. Scroll to find off-screen elements: `scroll({ direction: "down" })`

### Session Expired

1. Start a new session with `session_start`
2. Run the test with `verify` to get back to last state
3. Continue from where you left off

### Test Verification Fails

1. Check the error message and screenshot
2. Review the test file to see the generated code
3. Start a new session and manually test the failing step
4. Adjust element descriptions or add waits as needed

## Dependencies

When creating a new test project, use these exact dependencies:

**package.json:**
```json
{
  "type": "module",
  "devDependencies": {
    "testdriverai": "beta",
    "vitest": "^4.0.0"
  },
  "scripts": {
    "test": "vitest"
  }
}
```

**Important:** The package is `testdriverai` (NOT `@testdriverai/sdk`). Always install from the `beta` tag.

## Test File Format

Create test files using this standard format. Each action's generated code goes inside the test function:

```javascript
/**
 * Login Flow test
 * Generated by TestDriver MCP Server
 */
import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/lib/vitest/hooks.mjs";

describe("Login Flow", () => {
  it("should complete Login Flow", async (context) => {
    const testdriver = TestDriver(context);

    // --- GENERATED COMMANDS ---
    await testdriver.provision.chrome({ url: "https://app.example.com" });
    
    await testdriver.find("email input field").click();
    await testdriver.type("user@example.com");
    
    await testdriver.find("password field").click();
    await testdriver.type("secret123");
    
    await testdriver.find("Sign In button").click();
    
    const assertResult = await testdriver.assert("dashboard is visible");
    expect(assertResult).toBeTruthy();
    // --- END GENERATED ---
  });
});
```

## SDK Reference (for understanding generated tests)

The generated tests use these SDK methods:

| Method | Purpose |
|--------|---------|
| `provision.chrome({ url })` | Launch sandbox with Chrome at URL |
| `provision.installer({ url })` | Download and install desktop app |
| `find(description)` | Find element by natural language |
| `find(description).click()` | Find and click element |
| `type(text)` | Type text into focused field |
| `pressKeys([keys])` | Press keyboard keys |
| `scroll(direction)` | Scroll the page |
| `assert(assertion)` | AI-powered assertion |
| `exec(language, code)` | Execute code in sandbox |
| `screenshot()` | Capture screenshot |

### Element Properties

Elements returned by `find()` have these properties:

```javascript
const element = await testdriver.find("Sign In button");

console.log(element.x, element.y);           // coordinates
console.log(element.centerX, element.centerY); // center coordinates
console.log(element.width, element.height);  // dimensions
console.log(element.confidence);             // AI confidence score
console.log(element.text);                   // detected text
console.log(element.found());                // boolean: was it found?
```

### Element Methods

```javascript
const element = await testdriver.find("button");
await element.click();       // click
await element.hover();       // hover
await element.doubleClick(); // double-click
await element.rightClick();  // right-click
await element.mouseDown();   // press mouse down
await element.mouseUp();     // release mouse
```

## Tips for Agents

1. **Use MCP tools for development** - Each action returns the code to add to your test file
2. **Append code after each action** - The response includes `Add to test file:` with the exact code
3. **Use `check` to understand the screen** - This is how you (the AI) see and understand the current state. **Does NOT generate code.**
4. **Only use `screenshot` when the user asks** - Do NOT call screenshot automatically. Only use it when the user explicitly requests to see the screen.
5. **Use `check` during development** - Verify actions succeeded before moving on, but remember this is for YOUR understanding only
6. **Use `assert` for test file verifications** - When you want a verification step in the final test, use `assert` which generates `await testdriver.assert("...")` code
7. **Be specific with descriptions** - "blue Sign In button in the header" > "button"
8. **Check `sdk.d.ts`** for method signatures when debugging tests
