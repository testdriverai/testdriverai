# TestDriver MCP Server - AI Agent Guidelines

## Primary Goal: Create Vitest Tests Interactively

The main purpose of this MCP server is to help users **create Vitest test files** by interacting with a persistent TestDriver sandbox. You will:

1. **Connect** to a TestDriver sandbox (stays alive throughout the session)
2. **Interact** with the application using TestDriver commands
3. **Verify** each step with screenshots and assertions
4. **Generate** Vitest test code based on successful interactions

## Test Creation Workflow

### Step 1: Authorize and Connect

```typescript
// First, connect with API key - this creates a PERSISTENT sandbox
await testdriver_connect({ 
  apiKey: "user-provided-key" 
});

// Share the debugger URL with the user so they can watch live
```

**Important**: The sandbox persists until disconnected. You can perform multiple interactions without reconnecting.

### Step 2: Interactive Testing

Perform actions and verify each step:

```typescript
// Find an element
const element = await testdriver_find({ 
  description: "Username input field" 
});

// Take a screenshot to verify
await testdriver_screenshot({});

// Interact with it
await testdriver_click({ x: element.centerX, y: element.centerY });
await testdriver_type({ text: "test_user" });

// Verify the action succeeded
await testdriver_assert({ 
  assertion: "the username field contains 'test_user'" 
});

// Screenshot again to confirm
await testdriver_screenshot({});
```

### Step 3: Generate Vitest Test Code

After successful interactions, generate Vitest test code. Here's the pattern:

```javascript
import { describe, expect, it } from "vitest";
import { chrome } from "testdriverai/presets";

describe("Login Test", () => {
  it("should login successfully", async (context) => {
    const { testdriver } = await chrome(context, {
      url: 'http://example.com/login',
    });

    // Find and click username field
    const usernameField = await testdriver.find(
      "Username, input field for username",
    );
    await usernameField.click();
    await testdriver.type("test_user");

    // Find and click password field
    const passwordField = await testdriver.find(
      "Password, input field for password",
    );
    await passwordField.click();
    await testdriver.type("password123");

    // Click login button
    const loginButton = await testdriver.find(
      "Sign in, black button below the password field",
    );
    await loginButton.click();

    // Verify successful login
    const result = await testdriver.assert(
      "the user is logged in successfully",
    );
    expect(result).toBeTruthy();
  });
});
```

### Step 4: Save the Test

Create a file with the generated code and save it to the user's project.

## Essential Workflow

1. **Always connect first**: Call `testdriver_connect` before any other operations
2. **Share the debugger URL**: Give users the live view URL from connect response
3. **Use find() for elements**: Prefer `testdriver_find` over hardcoded coordinates
4. **Take screenshots frequently**: Capture before and after important actions
5. **Assert expectations**: Verify each critical step with `testdriver_assert`
6. **Generate code as you go**: Translate successful MCP calls into Vitest code

## Available Tools

### Connection
- `testdriver_connect({ apiKey })` - Connect to sandbox (required first step)
- `testdriver_disconnect()` - Clean up and disconnect

### Element Finding (Recommended)
- `testdriver_find({ description, cacheThreshold? })` - Find element by description
- `testdriver_findAll({ description, cacheThreshold? })` - Find all matching elements

### Direct Interaction
- `testdriver_click({ x, y, action? })` - Click at coordinates
- `testdriver_hover({ x, y })` - Hover at coordinates
- `testdriver_type({ text, delay? })` - Type text
- `testdriver_pressKeys({ keys })` - Press key combinations
- `testdriver_scroll({ direction?, amount?, method? })` - Scroll page

### AI-Powered
- `testdriver_assert({ assertion, async?, invert? })` - Verify state with natural language
- `testdriver_remember({ description })` - Extract information from screen
- `testdriver_ai({ task, validateAndLoop? })` - Execute complex tasks autonomously

### Utilities
- `testdriver_screenshot({ scale?, mouse? })` - Capture screen (returns image)
- `testdriver_focusApplication({ name })` - Switch to application
- `testdriver_exec({ language, code, timeout, silent? })` - Execute code
- `testdriver_wait({ timeout? })` - Wait for time

## Common Patterns

### Login Flow (Modern Approach)

```typescript
// 1. Connect
await testdriver_connect({ apiKey: "..." });

// 2. Take initial screenshot
await testdriver_screenshot({});

// 3. Find and click username field
const usernameField = await testdriver_find({ 
  description: "username input field" 
});
await testdriver_click({ 
  x: usernameField.centerX, 
  y: usernameField.centerY 
});

// 4. Type username
await testdriver_type({ text: "user@example.com" });

// 5. Find and click password field
const passwordField = await testdriver_find({ 
  description: "password input field" 
});
await testdriver_click({ 
  x: passwordField.centerX, 
  y: passwordField.centerY 
});

// 6. Type password
await testdriver_type({ text: "password123" });

// 7. Find and click login button
const loginBtn = await testdriver_find({ 
  description: "login button" 
});
await testdriver_click({ 
  x: loginBtn.centerX, 
  y: loginBtn.centerY 
});

// 8. Verify success
await testdriver_assert({ 
  assertion: "the user is logged in successfully" 
});

// 9. Take final screenshot
await testdriver_screenshot({});
```

### Using AI for Complex Tasks

```typescript
// Let AI handle the entire workflow
await testdriver_connect({ apiKey: "..." });

await testdriver_ai({
  task: "Log in with user@example.com and password123, then navigate to the settings page",
  validateAndLoop: true
});

await testdriver_screenshot({});
```

### Form Testing Pattern

```typescript
// 1. Find and fill each field
const nameField = await testdriver_find({ description: "name field" });
await testdriver_click({ x: nameField.centerX, y: nameField.centerY });
await testdriver_type({ text: "John Doe" });

// 2. Take screenshot before submit
await testdriver_screenshot({});

// 3. Submit form
const submitBtn = await testdriver_find({ description: "submit button" });
await testdriver_click({ x: submitBtn.centerX, y: submitBtn.centerY });

// 4. Assert success
await testdriver_assert({ assertion: "the form was submitted successfully" });

// 5. Capture dynamic values
const orderId = await testdriver_remember({ description: "the order ID" });
```

## Best Practices

- **Use find() for reliability**: Element finding is more reliable than hardcoded coordinates
- **Take screenshots often**: Capture before and after important actions
- **Use descriptive element descriptions**: "the blue Submit button at the bottom" not just "Submit"
- **Verify with assertions**: Check that actions succeeded with `testdriver_assert`
- **Share debugger URL**: Always share the URL from connect response with users
- **Handle cache threshold**: Lower values (e.g., 0.01) = stricter matching, higher (e.g., 0.1) = more lenient

## Common Mistakes to Avoid

❌ Don't forget to connect first
✅ Do call `testdriver_connect` before any operations

❌ Don't use hardcoded coordinates for dynamic elements
✅ Do use `testdriver_find` to locate elements

❌ Don't assume actions succeeded
✅ Do take screenshots and use assertions

❌ Don't use vague element descriptions
✅ Do be specific: "red delete button in the top right corner"

❌ Don't forget error handling
✅ Do check for errors in responses and handle gracefully

## Cache Threshold Guide

The `cacheThreshold` parameter controls how strict element matching is:

- **0.01** (1% difference, 99% similarity) - Very strict, use for exact matches
- **0.05** (5% difference, 95% similarity) - Default, balanced
- **0.10** (10% difference, 90% similarity) - More lenient, use when elements vary slightly

Example:
```typescript
// Strict matching
await testdriver_find({ 
  description: "logo", 
  cacheThreshold: 0.01 
});

// Lenient matching (good for dynamic content)
await testdriver_find({ 
  description: "profile picture", 
  cacheThreshold: 0.10 
});
```
