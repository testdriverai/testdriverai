# TestDriver MCP Server

Model Context Protocol (MCP) server for TestDriver.ai - enables AI agents to **create Vitest tests interactively** by spawning and interacting with persistent TestDriver sandboxes.

## Purpose

This MCP server helps AI agents create Vitest test code by:
1. Connecting to a persistent TestDriver sandbox
2. Interactively testing the application 
3. Generating Vitest test code from successful interactions

The AI agent can explore the application, verify behavior, and automatically generate proper test code.

## Installation

```bash
cd mcp-server
npm install
npm run build
```

## Configuration

Add to your MCP settings (e.g., `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "testdriverai": {
      "command": "node",
      "args": ["/path/to/cli/mcp-server/dist/index.js"],
      "env": {
        "TESTDRIVER_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Or in VS Code's `.vscode/mcp.json`:

```json
{
  "servers": {
    "testdriverai": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/cli/mcp-server/dist/index.js"],
      "env": {
        "TESTDRIVER_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Available Tools

### Connection Management

- **testdriver_connect** - Connect to a TestDriver sandbox environment
  - Returns debugger URL for live viewing
  - Must be called before any other operations

- **testdriver_disconnect** - Disconnect from sandbox and clean up

### Element Finding (Recommended Approach)

- **testdriver_find** - Find an element by description
  - Returns coordinates and metadata
  - Example: `find("the blue submit button")`

- **testdriver_findAll** - Find all matching elements
  - Returns array of elements with coordinates

### Direct Interaction

- **testdriver_click** - Click at coordinates
- **testdriver_hover** - Hover at coordinates
- **testdriver_type** - Type text into focused field
- **testdriver_pressKeys** - Press keyboard combinations
- **testdriver_scroll** - Scroll in a direction

### AI-Powered Operations

- **testdriver_assert** - Verify screen state with natural language
  - Example: `assert("the user is logged in")`

- **testdriver_remember** - Extract information from screen
  - Example: `remember("the order number")`

- **testdriver_ai** - Execute complex tasks with AI
  - Example: `ai("fill out the contact form with test data")`

### Utilities

- **testdriver_screenshot** - Capture current screen (returns image)
- **testdriver_focusApplication** - Switch to an application
- **testdriver_exec** - Execute JS or PowerShell code
- **testdriver_wait** - Wait for specified time

## Usage Examples

### Creating a Vitest Test Interactively

The typical workflow for creating a test:

```typescript
// 1. Connect to sandbox (creates persistent connection)
await testdriver_connect({
  apiKey: "td-..."
});
// Returns debugger URL - share with user to watch live

// 2. Take initial screenshot
await testdriver_screenshot({});

// 3. Find elements and interact
const usernameField = await testdriver_find({
  description: "Username input field"
});

await testdriver_click({
  x: usernameField.centerX,
  y: usernameField.centerY
});

await testdriver_type({
  text: "test_user"
});

// 4. Verify the action
await testdriver_assert({
  assertion: "the username field contains 'test_user'"
});

await testdriver_screenshot({});

// 5. Continue with more interactions...
// 6. Generate Vitest code from these successful steps
// 7. Save to test file

// The sandbox persists - no need to reconnect!
```

### Generated Vitest Test

The AI translates the interactions into proper Vitest code:

```javascript
import { describe, expect, it } from "vitest";
import { chrome } from "testdriverai/presets";

describe("Login Test", () => {
  it("should enter username", async (context) => {
    const { testdriver } = await chrome(context, {
      url: 'http://example.com/login',
    });

    const usernameField = await testdriver.find(
      "Username input field",
    );
    await usernameField.click();
    await testdriver.type("test_user");

    const result = await testdriver.assert(
      "the username field contains 'test_user'",
    );
    expect(result).toBeTruthy();
  });
});
```

## Best Practices

1. **Persistent Connection** - Connect once at the start; the sandbox stays alive
2. **Share Debugger URL** - Always give users the debugger URL to watch live
3. **Use find() for reliability** - Prefer element finding over hardcoded coordinates
4. **Screenshot frequently** - Capture before/after important actions to verify
5. **Assert expectations** - Verify each step with assertions
6. **Generate code incrementally** - Translate successful interactions into Vitest code as you go
7. **Follow Vitest patterns** - Use the chrome preset and proper test structure

## Development

```bash
# Build TypeScript
npm run build

# Watch mode for development
npm run dev

# Test the server
node dist/index.js
```

## API Key

Get your TestDriver API key from https://v6.testdriver.ai/settings
