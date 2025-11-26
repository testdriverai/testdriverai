# Interactive Vitest Test Creation Guide

## Overview

The TestDriver MCP server enables AI agents to create Vitest test files by interactively testing applications in a persistent sandbox environment.

## The Workflow

### 1. User Provides API Key

User shares their TestDriver API key (from https://v6.testdriver.ai/settings)

### 2. Connect to Persistent Sandbox

```typescript
const result = await testdriver_connect({ 
  apiKey: "td-xxx-yyy-zzz" 
});
```

**Key Points:**
- This creates a **persistent connection** - sandbox stays alive
- Returns a debugger URL - **share this with the user** so they can watch
- No need to reconnect between operations
- Sandbox persists until `testdriver_disconnect` is called

### 3. Interactive Testing

Explore and test the application:

```typescript
// 1. Take screenshot to see current state
await testdriver_screenshot({});

// 2. Find an element by description
const element = await testdriver_find({
  description: "Username input field, text box at the top of the form"
});
// Returns: { x, y, centerX, centerY, confidence, ... }

// 3. Click on it
await testdriver_click({
  x: element.centerX,
  y: element.centerY
});

// 4. Type text
await testdriver_type({
  text: "test_user"
});

// 5. Verify the action succeeded
await testdriver_assert({
  assertion: "the username field contains 'test_user'"
});
// Returns: true/false

// 6. Take another screenshot to confirm
await testdriver_screenshot({});
```

### 4. Generate Vitest Test Code

As the AI performs successful interactions, translate them into Vitest test code:

```javascript
import { describe, expect, it } from "vitest";
import { chrome } from "testdriverai/presets";

describe("Login Test", () => {
  it("should enter username successfully", async (context) => {
    // Setup using chrome preset
    const { testdriver } = await chrome(context, {
      url: 'http://example.com/login',
    });

    // Find and click username field
    const usernameField = await testdriver.find(
      "Username input field, text box at the top of the form",
    );
    await usernameField.click();
    
    // Type username
    await testdriver.type("test_user");

    // Verify success
    const result = await testdriver.assert(
      "the username field contains 'test_user'",
    );
    expect(result).toBeTruthy();
  });
});
```

### 5. Save Test File

Create the test file in the user's project:

```bash
# Suggested location
test/login.test.mjs
# or
testdriver/acceptance-sdk/login.test.mjs
```

## Code Generation Patterns

### MCP Call → Vitest Code

| MCP Call | Vitest Code |
|----------|-------------|
| `testdriver_find({ description: "button" })` | `const element = await testdriver.find("button");` |
| `testdriver_click({ x, y })` | `await element.click();` |
| `testdriver_type({ text: "hello" })` | `await testdriver.type("hello");` |
| `testdriver_pressKeys({ keys: ["ctrl", "c"] })` | `await testdriver.pressKeys(["ctrl", "c"]);` |
| `testdriver_assert({ assertion: "X" })` | `const result = await testdriver.assert("X"); expect(result).toBeTruthy();` |

### Preset Mapping

Based on the URL or application, choose the appropriate preset:

```javascript
// Web application
const { testdriver } = await chrome(context, {
  url: 'http://example.com',
});

// VS Code workspace
const { testdriver } = await vscode(context, {
  workspace: '/path/to/project',
});

// Electron app
const { testdriver } = await electron(context, {
  appPath: '/path/to/app',
});
```

## Best Practices

### 1. Descriptive Element Descriptions

```typescript
// ❌ Too vague
await testdriver_find({ description: "button" });

// ✅ Specific and descriptive
await testdriver_find({ 
  description: "Sign In button, black button below the password field" 
});
```

### 2. Screenshot Frequently

Take screenshots before and after important actions to verify success.

### 3. Assert Critical Steps

Use assertions to verify expected behavior:

```typescript
await testdriver_assert({
  assertion: "the user is logged in successfully"
});
```

### 4. Follow Vitest Patterns

Structure tests properly:

```javascript
describe("Feature Name", () => {
  it("should do something specific", async (context) => {
    // Test code here
  });
});
```

### 5. Use Element.click() Pattern

When you find an element, use its click method rather than separate click call:

```javascript
// ✅ Preferred
const button = await testdriver.find("submit button");
await button.click();

// ⚠️ Also works but less idiomatic
const button = await testdriver.find("submit button");
await testdriver.click({ x: button.centerX, y: button.centerY });
```

## Example: Complete Test Creation Session

```typescript
// 1. Connect
await testdriver_connect({ apiKey: "td-xxx" });
// Share debugger URL with user

// 2. Screenshot initial state
await testdriver_screenshot({});

// 3. Find username field
const username = await testdriver_find({
  description: "Username field"
});

// 4. Click and type
await testdriver_click({ x: username.centerX, y: username.centerY });
await testdriver_type({ text: "admin" });

// 5. Verify
await testdriver_assert({
  assertion: "username field contains 'admin'"
});

// 6. Find password field
const password = await testdriver_find({
  description: "Password field"
});

// 7. Click and type
await testdriver_click({ x: password.centerX, y: password.centerY });
await testdriver_type({ text: "password123" });

// 8. Find and click submit
const submit = await testdriver_find({
  description: "Sign in button"
});
await testdriver_click({ x: submit.centerX, y: submit.centerY });

// 9. Verify login
await testdriver_assert({
  assertion: "user is logged in successfully"
});

// 10. Screenshot final state
await testdriver_screenshot({});
```

**Generated Vitest Test:**

```javascript
import { describe, expect, it } from "vitest";
import { chrome } from "testdriverai/presets";

describe("Login Test", () => {
  it("should login successfully", async (context) => {
    const { testdriver } = await chrome(context, {
      url: 'http://example.com/login',
    });

    // Enter username
    const usernameField = await testdriver.find("Username field");
    await usernameField.click();
    await testdriver.type("admin");

    // Verify username
    let result = await testdriver.assert(
      "username field contains 'admin'"
    );
    expect(result).toBeTruthy();

    // Enter password
    const passwordField = await testdriver.find("Password field");
    await passwordField.click();
    await testdriver.type("password123");

    // Click sign in
    const signInButton = await testdriver.find("Sign in button");
    await signInButton.click();

    // Verify login
    result = await testdriver.assert(
      "user is logged in successfully"
    );
    expect(result).toBeTruthy();
  });
});
```

## Tips for AI Agents

1. **Always share the debugger URL** - Users want to watch the test live
2. **Take screenshots liberally** - Helps verify each step succeeded
3. **Use descriptive element descriptions** - Include location, color, text
4. **Translate incrementally** - Generate code as you go, not all at once
5. **Handle errors gracefully** - If find fails, try a different description
6. **Maintain sandbox connection** - No need to reconnect between steps
7. **Ask for clarification** - If unsure about element description, ask user
8. **Test the test** - Make sure generated code would actually work

## Troubleshooting

**Element not found:**
- Try a more specific description
- Take a screenshot to see what's on screen
- Check if element is visible (may need to scroll)

**Assertion fails:**
- Verify the action completed (take screenshot)
- Adjust assertion text to match actual state
- May need to wait for element to appear

**Connection issues:**
- Verify API key is correct
- Check if sandbox is still running
- Reconnect if needed (though sandbox persists)

## Reference

- Full docs: `README.md`
- AI guidelines: `AI_GUIDELINES.md`
- Quick reference: `QUICK_REFERENCE.md`
- Example tests: `/testdriver/acceptance-sdk/*.test.mjs`
