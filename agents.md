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
2. **Interact**: Use `find`, `click`, `type` - each returns a screenshot showing the result
3. **Check**: Use `check` after actions to verify if the task completed successfully
4. **Assert**: Use `assert` for specific boolean pass/fail conditions
5. **Commit**: Use `commit` to write commands to a test file
6. **Verify test**: Use `verify` to run the generated test from scratch

**Key advantages:**
- See screenshots inline after every action
- Use `check` to get AI analysis of whether actions succeeded
- No need to re-run the entire test for each change
- Automatic command recording and code generation
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
| `session_start` | Start sandbox with browser/app, returns initial screenshot |
| `session_status` | Check session health, time remaining, command count |
| `session_extend` | Add more time before session expires |

### Element Interaction

| Tool | Description |
|------|-------------|
| `find` | Locate element by natural language description, returns ref for later use |
| `click` | Click on element ref or coordinates |
| `find_and_click` | Find and click in one action |
| `type` | Type text into focused field |
| `press_keys` | Press keyboard shortcuts (e.g., `["ctrl", "a"]`) |
| `scroll` | Scroll page (up/down/left/right) |

### Verification & Display

| Tool | Description |
|------|-------------|
| `check` | **For AI to understand screen state.** Analyzes current screen and returns detailed feedback about whether a task/condition is met. Use this after actions to verify they worked. |
| `assert` | AI-powered boolean assertion for test files (pass/fail). Gets recorded in generated tests. |
| `screenshot` | **For showing the user the screen.** Captures and displays a screenshot. Does NOT return analysis to AI. |
| `exec` | Execute JavaScript, shell, or PowerShell in sandbox |

### Test Generation

| Tool | Description |
|------|-------------|
| `commit` | Write recorded commands to test file |
| `verify` | Run test file from scratch to validate |
| `get_command_log` | View recorded commands before committing |

## Workflow Example

```
# 1. Start a session
session_start({ type: "chrome", url: "https://app.example.com/login" })
→ Screenshot shows login page

# 2. Fill in email
find_and_click({ description: "email input field" })
→ Screenshot shows cursor in email field

type({ text: "user@example.com" })
→ Screenshot shows typed email

# 3. Check if email was entered correctly
check({ task: "Was the email entered into the input field?" })
→ AI confirms email is visible in the field

# 4. Fill in password
find_and_click({ description: "password input field" })
type({ text: "secret123" })

# 5. Submit login
find_and_click({ description: "Sign In button" })
→ Screenshot shows page changing

# 6. Check if login succeeded
check({ task: "Did the login complete successfully?" })
→ AI analyzes screen and confirms dashboard is visible

# 7. Assert success (for the test file)
assert({ assertion: "I can see the user dashboard" })
→ Pass with screenshot

# 8. Commit to test file
commit({ 
  testFile: "tests/login.test.mjs",
  testName: "Login Flow"
})
→ Test file generated

# 9. Verify the test runs correctly
verify({ testFile: "tests/login.test.mjs" })
→ Test passes from scratch
```

## Visual Feedback

Action tools (`find`, `click`, `find_and_click`, etc.) return screenshots showing:

- **Element highlights** - Blue box around found elements
- **Click markers** - Red dot with ripple effect at click location
- **Scroll indicators** - Arrow showing scroll direction
- **Action status** - Success/failure with duration
- **Session info** - Time remaining before expiry

**Important distinction:**
- Use `screenshot` to **show the user** the current screen state
- Use `check` for **AI to understand** the screen state (returns analysis, not just an image)

## Best Practices

### 1. Work Incrementally

Don't try to build the entire test at once. After each action:
- Examine the screenshot
- Use `check` to verify the action worked
- Then proceed to the next step

### 2. Use Check After Actions

Use `check` to verify actions completed successfully:
```
find_and_click({ description: "Submit button" })
check({ task: "Was the form submitted?" })
```

The `check` tool compares the previous screenshot with the current state and gives you AI analysis of whether your action succeeded.

### 3. Use Assertions for Test Files

Add `assert` calls after major state changes. They're included in the generated test file and provide boolean pass/fail for CI.

### 3. Handle Timing Issues

If elements take time to appear, use `find` with timeout:

```
find({ description: "Loading complete indicator", timeout: 30000 })
```

### 4. Watch Session Time

Sessions expire after 5 minutes by default. Check with `session_status` and extend with `session_extend` if needed.

### 5. Commit Often

After each successful interaction sequence, commit to preserve your progress:

```
commit({ testFile: "tests/my-test.test.mjs", testName: "My Test" })
```

## Error Recovery

### Element Not Found

1. Check the screenshot to see what's actually on screen
2. Adjust the element description to be more specific
3. Use timeout: `find({ description: "...", timeout: 10000 })`
4. Scroll to find off-screen elements: `scroll({ direction: "down" })`

### Session Expired

1. Start a new session with `session_start`
2. Run the committed test with `verify` to get back to last state
3. Continue from where you left off

### Test Verification Fails

1. Check the error message and screenshot
2. Use `get_command_log` to see what was recorded
3. Start a new session and manually test the failing step
4. Adjust element descriptions or add waits as needed

## Generated Test Format

The `commit` tool generates standard TestDriver test files:

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

1. **Use MCP tools for development** - Don't write test files manually
2. **Use `check` to understand the screen** - This is how you (the AI) see and understand the current state
3. **Use `screenshot` to show the user** - This displays the screen to the user but doesn't return analysis to you
4. **Use `check` after actions** - Verify actions succeeded before moving on
5. **Be specific with descriptions** - "blue Sign In button in the header" > "button"
6. **Assert after major actions** - Helps catch issues early and gets recorded in test files
7. **Commit working sequences** - Don't lose progress
8. **Check `sdk.d.ts`** for method signatures when debugging generated tests
