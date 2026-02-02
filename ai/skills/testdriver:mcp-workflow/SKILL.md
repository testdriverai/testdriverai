---
name: testdriver:mcp-workflow
description: Build TestDriver tests iteratively using MCP tools with visual feedback
---

# TestDriver MCP Workflow

Build automated tests by directly controlling a sandbox through MCP tools. Every action returns a screenshot AND the generated code to add to your test file.

## When to Use This Skill

Use this skill when:
- You have access to TestDriver MCP tools (`session_start`, `find`, `click`, etc.)
- User asks to "write a test", "automate this workflow", "check if X works"
- You need to build tests iteratively with visual feedback

## Overview

Use MCP tools to:

1. **Control the sandbox directly** - Click, type, scroll in real-time
2. **See visual feedback** - Every action shows a screenshot with overlays
3. **Get generated code** - Each successful action returns the code to add to your test file
4. **Build tests incrementally** - Append code to test files as you go

## Quick Start

### 1. Start a Session

```
session_start({ type: "chrome", url: "https://your-app.com" })
```

This provisions a sandbox with Chrome and navigates to your URL. You'll see a screenshot and the provision code:

```
Add to test file:
await testdriver.provision.chrome({ url: "https://your-app.com" });
```

**For local development** (pointing to a custom API endpoint):

```
session_start({ 
  type: "chrome", 
  url: "https://your-app.com",
  apiRoot: "https://your-ngrok-url.ngrok.io"
})
```

**For self-hosted AWS instances** (your own Windows EC2):

```
session_start({ 
  type: "chrome", 
  url: "https://your-app.com",
  os: "windows",
  ip: "1.2.3.4"  // IP from your AWS instance
})
```

See [AWS Setup Guide](https://docs.testdriver.ai/v7/aws-setup) to deploy your own infrastructure.

### 2. Interact with the App

Find elements and interact with them. Each action returns a screenshot AND generated code:

```
find_and_click({ description: "Sign In button" })
→ Returns: screenshot with element highlighted
→ Add to test file: await testdriver.find("Sign In button").click();

type({ text: "user@example.com" })
→ Returns: screenshot showing typed text
→ Add to test file: await testdriver.type("user@example.com");
```

### 3. Check If Actions Succeeded

After performing actions, use `check` to verify they worked:

```
check({ task: "Was the text entered into the field?" })
→ Returns: AI analysis of whether the task completed, with screenshot

check({ task: "Did the button click navigate to a new page?" })
→ Returns: AI compares previous screenshot to current state
```

### 4. Make Assertions (for Test Files)

Use `assert` for boolean pass/fail conditions that get recorded in test files:

```
assert({ assertion: "the login form is visible" })
→ Returns: pass/fail with screenshot
→ Add to test file:
   const assertResult = await testdriver.assert("the login form is visible");
   expect(assertResult).toBeTruthy();
```

### 5. Write the Test File

As you perform actions, append the generated code to your test file:

```javascript
/**
 * Login Flow test
 */
import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/lib/vitest/hooks.mjs";

describe("Login Flow", () => {
  it("should complete login", async (context) => {
    const testdriver = TestDriver(context);

    // Append generated code here as you go:
    await testdriver.provision.chrome({ url: "https://app.example.com" });
    await testdriver.find("email input field").click();
    await testdriver.type("user@example.com");
    // ... more code as you perform actions
  });
});
```

### 6. Verify the Test

Run the test from scratch to validate it works:

```
verify({ testFile: "tests/login.test.mjs" })
```

## Tools Reference

### Session Management

| Tool | Description |
|------|-------------|
| `session_start` | Start sandbox with browser/app, returns screenshot + provision code |
| `session_status` | Check session health and time remaining |
| `session_extend` | Add more time before session expires |

### Element Interaction

Each tool returns a screenshot AND the generated code to add to your test file.

| Tool | Description |
|------|-------------|
| `find` | Locate element by description, returns ref for later use |
| `click` | Click on element ref |
| `find_and_click` | Find and click in one action |
| `type` | Type text into focused field |
| `press_keys` | Press keyboard shortcuts (e.g., `["ctrl", "a"]`) |
| `scroll` | Scroll page (up/down/left/right) |

### Verification & Display

| Tool | Description |
|------|-------------|
| `check` | **For AI to understand screen state.** Analyzes current screen and tells you (the AI) whether a task/condition is met. Use this after actions to verify they worked. |
| `assert` | AI-powered boolean assertion for test files (pass/fail for CI). Returns generated code. |
| `screenshot` | **For showing the user the screen.** Captures and displays a screenshot. Does NOT return analysis to you (the AI). |
| `exec` | Execute JavaScript, shell, or PowerShell in sandbox. Returns generated code. |

### Test Validation

| Tool | Description |
|------|-------------|
| `verify` | Run test file from scratch to validate it works |

## Visual Feedback

Every tool returns a screenshot showing:

- **Element highlights** - Blue box around found elements
- **Click markers** - Red dot with ripple effect at click location
- **Scroll indicators** - Arrow showing scroll direction
- **Action status** - Success/failure with duration
- **Session info** - Time remaining before expiry

## Workflow Best Practices

### 1. Work Incrementally

Don't try to build the entire test at once:

```
# Step 1: Get to login page
session_start({ url: "https://app.com" })
→ Add to test: await testdriver.provision.chrome({ url: "https://app.com" });

# Step 2: Verify you're on the right page
check({ task: "Is this the login page?" })

# Step 3: Fill in email
find_and_click({ description: "email input field" })
→ Add to test: await testdriver.find("email input field").click();

type({ text: "user@example.com" })
→ Add to test: await testdriver.type("user@example.com");

# Step 4: Check if email was entered
check({ task: "Was the email entered correctly?" })

# Step 5: Continue with password...
```

### 2. Use Check After Actions

After each action, use `check` to verify it worked:

```
find_and_click({ description: "Submit button" })
check({ task: "Was the form submitted?" })
```

The `check` tool compares the previous screenshot (from before your action) with the current state, giving you AI analysis of what changed and whether the action succeeded.

### 3. Understanding Screen State

**For AI understanding:** Use `check` to analyze the screen:
```
check({ task: "Did the form submit successfully?" })
→ Returns AI analysis you can read and understand
```

**For user visibility:** Use `screenshot` to show the user:
```
screenshot()
→ Displays to user, no analysis returned to you
```

Action tools (`find`, `click`, `find_and_click`) return screenshots automatically, which the user can see. But if you need to understand the state, use `check`.

### 4. Handle Timing Issues

If elements take time to appear, use `find` with timeout:

```
find({ description: "Loading complete indicator", timeout: 30000 })
```

### 5. Check Session Time

Sessions expire after 5 minutes by default. Use `session_status` to check time remaining and `session_extend` to add more time:

```
session_status()
→ "Time remaining: 45s"

session_extend({ additionalMs: 60000 })
→ "New expiry: 105s"
```

### 6. Write Code as You Go

After each successful action, append the generated code to your test file. This ensures you don't lose progress and makes the test easier to debug.

## Error Recovery

### Element Not Found

If `find` fails:

1. Check the screenshot to see what's actually on screen
2. Adjust the element description to be more specific
3. Wait for page load with timeout: `find({ description: "...", timeout: 10000 })`
4. Scroll to find off-screen elements: `scroll({ direction: "down" })`

### Session Expired

If the session expires:

1. `session_start` again with the same URL
2. Run the test with `verify` to get back to last state
3. Continue from where you left off

### Test Verification Fails

If `verify` fails:

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

Create test files using this standard format. Append generated code inside the test function:

```javascript
/**
 * Login Flow test
 */
import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/lib/vitest/hooks.mjs";

describe("Login Flow", () => {
  it("should complete Login Flow", async (context) => {
    const testdriver = TestDriver(context);

    // Append generated code from each action here:
    await testdriver.provision.chrome({ url: "https://app.example.com" });
    
    await testdriver.find("email input field").click();
    await testdriver.type("user@example.com");
    
    await testdriver.find("password field").click();
    await testdriver.type("secret123");
    
    await testdriver.find("Sign In button").click();
    
    const assertResult = await testdriver.assert("dashboard is visible");
    expect(assertResult).toBeTruthy();
  });
});
```

## Self-Hosted AWS Instances

You can use your own AWS-hosted Windows instances instead of TestDriver cloud. This gives you:

- **Flat license fee** - No device-second metering
- **Your own AI keys** - Use your OpenAI/Anthropic keys
- **Custom configuration** - Install custom software, configure networking
- **Full debugging access** - RDP into instances

### Quick Setup

1. **Deploy AWS infrastructure** using [CloudFormation](https://docs.testdriver.ai/v7/aws-setup)

2. **Spawn an instance**:
   ```bash
   AWS_REGION=us-east-2 \
   AMI_ID=ami-0504bf50fad62f312 \
   AWS_LAUNCH_TEMPLATE_ID=lt-xxx \
   bash setup/aws/spawn-runner.sh
   ```
   Output: `PUBLIC_IP=1.2.3.4`

3. **Connect via session_start**:
   ```
   session_start({
     type: "chrome",
     url: "https://example.com",
     os: "windows",
     ip: "1.2.3.4"
   })
   ```

4. **Terminate when done**:
   ```bash
   aws ec2 terminate-instances --instance-ids i-xxx --region us-east-2
   ```

### Environment Variable

You can also set `TD_IP` environment variable in your MCP config instead of passing `ip` to each session:

```json
{
  "mcpServers": {
    "testdriver": {
      "env": {
        "TD_API_KEY": "your-key",
        "TD_IP": "1.2.3.4"
      }
    }
  }
}
```

## Tips

1. **Every action returns generated code** - Look for "Add to test file:" in responses and append that code

2. **Use `check` to understand the screen** - This is how you (the AI) see and analyze the current state

3. **Use `screenshot` to show the user** - This displays the screen to the user, but does NOT return analysis to you

4. **Use `check` after every action** - Verify your actions succeeded before moving on

5. **Be specific with element descriptions** - "the blue Sign In button in the header" is better than "button"

6. **Use `check` for verification, `assert` for test files** - `check` gives detailed AI analysis, `assert` gives boolean pass/fail for CI

7. **Write code incrementally** - Append generated code to your test file after each successful action

8. **Extend session proactively** - If you have complex workflows, extend before you run out of time
