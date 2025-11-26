# TestDriver MCP Quick Reference

## Goal: Create Vitest Tests Interactively

This MCP server helps AI agents create Vitest test files by:
1. Connecting to a **persistent** TestDriver sandbox
2. Interacting with the application using TestDriver commands
3. Generating Vitest test code from successful interactions

## Installation

```bash
cd mcp-server
npm install && npm run build
npm run deploy  # Install to ~/.mcp/testdriver
```

## Configuration

```json
{
  "servers": {
    "testdriverai": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/cli/mcp-server/dist/index.js"]
    }
  }
}
```

## Common Tool Calls

### Connect
```typescript
testdriver_connect({ 
  apiKey: "td-..." 
})
```

### Find Element
```typescript
testdriver_find({ 
  description: "login button",
  cacheThreshold: 0.05  // optional
})
```

### Click
```typescript
testdriver_click({ 
  x: 100, 
  y: 200,
  action: "click"  // or "right-click", "double-click"
})
```

### Type
```typescript
testdriver_type({ 
  text: "Hello World",
  delay: 250  // optional, ms between keystrokes
})
```

### Press Keys
```typescript
testdriver_pressKeys({ 
  keys: ["ctrl", "c"]
})
```

### Assert
```typescript
testdriver_assert({ 
  assertion: "the user is logged in"
})
```

### Screenshot
```typescript
testdriver_screenshot({ 
  scale: 1,    // optional
  mouse: false // optional, show cursor
})
```

### Remember
```typescript
testdriver_remember({ 
  description: "the order number"
})
```

### AI Task
```typescript
testdriver_ai({ 
  task: "fill out the form",
  validateAndLoop: true  // optional
})
```

## Typical Workflow

### 1. Connect (Persistent)
```typescript
testdriver_connect({ apiKey: "td-..." })
// Returns debugger URL - share with user!
// Sandbox stays alive until disconnect
```

### 2. Explore & Test
```typescript
// Take screenshot
testdriver_screenshot({})

// Find element
testdriver_find({ description: "login button" })

// Interact
testdriver_click({ x: 100, y: 200 })
testdriver_type({ text: "username" })

// Verify
testdriver_assert({ assertion: "user is logged in" })
```

### 3. Generate Vitest Code

Translate successful MCP interactions into Vitest test code:

```javascript
import { describe, expect, it } from "vitest";
import { chrome } from "testdriverai/presets";

describe("My Test", () => {
  it("should do something", async (context) => {
    const { testdriver } = await chrome(context, {
      url: 'http://example.com',
    });

    // Your interactions here
    const element = await testdriver.find("description");
    await element.click();
    
    const result = await testdriver.assert("expected state");
    expect(result).toBeTruthy();
  });
});
```

### 4. Save Test File

Save the generated code to a `.test.mjs` file in the user's project.

## Common Tool Calls

- `0.01` = 99% similarity (strict)
- `0.05` = 95% similarity (default)
- `0.10` = 90% similarity (lenient)

## Error Handling

All tools return `isError: true` on failure with error details in the response.

## Documentation

- Full guide: `README.md`
- Best practices: `AI_GUIDELINES.md`
- Deployment: `DEPLOYMENT.md`
- Changes: `UPDATE_SUMMARY.md`
