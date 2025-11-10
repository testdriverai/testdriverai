# TestDriver MCP Server

A Model Context Protocol (MCP) server that exposes TestDriver SDK methods as tools for Claude and other AI assistants.

## Installation

1. Install dependencies:
```bash
cd mcp-server
npm install
```

2. Set your TestDriver API key:
```bash
export TD_API_KEY=your-api-key-here
```

## Configuration

### Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "testdriver": {
      "command": "node",
      "args": [
        "/absolute/path/to/cli/mcp-server/index.js"
      ],
      "env": {
        "TD_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### VS Code (with this workspace)

The `.vscode/mcp.json` configuration has been updated to use the new server location.

## Available Tools

The MCP server exposes the following TestDriver tools:

### Connection Management
- `testdriver_connect` - Connect to TestDriver sandbox (with optional debugger UI)
- `testdriver_disconnect` - Disconnect from sandbox
- `testdriver_getDebuggerUrl` - Get URL of live debugger showing VM screen
- `testdriver_getSandboxInfo` - Get sandbox details (ID, IP, status)

### Test File Management
- `testdriver_writeTestFile` - Create or append to a test file (YAML/JavaScript)
- `testdriver_readTestFile` - Read test file contents
- `testdriver_runTestFile` - Execute a test file in the current sandbox
- `testdriver_appendYamlCommand` - Append a single command to YAML test
- `testdriver_createTestFromActions` - Generate complete test from action history

### Interaction
- `testdriver_hoverText` - Click or hover text elements
- `testdriver_hoverImage` - Click or hover image elements
- `testdriver_type` - Type text into inputs
- `testdriver_pressKeys` - Press keyboard keys
- `testdriver_scroll` - Scroll the page
- `testdriver_scrollUntilText` - Scroll until text is visible
- `testdriver_scrollUntilImage` - Scroll until image is visible

### Waiting & Assertions
- `testdriver_wait` - Wait for a duration
- `testdriver_waitForText` - Wait for text to appear
- `testdriver_waitForImage` - Wait for image to appear
- `testdriver_assert` - Assert a condition

### Advanced
- `testdriver_remember` - Extract text from screen
- `testdriver_focusApplication` - Focus an application window
- `testdriver_exec` - Execute code in sandbox
- `testdriver_matchImage` - Match a reference image
- `testdriver_run` - Run a YAML file
- `testdriver_getScreenshot` - Capture screenshot

## Usage Examples

### Example 1: Spawn VM with Debugger and Build Test

```
Claude, please:
1. Connect to TestDriver with the debugger enabled
2. Give me the debugger URL so I can watch the VM
3. Navigate to https://testdriver-sandbox.vercel.app/login
4. Build a test file incrementally at ./tests/login.yaml:
   - Wait for the login page
   - Click Username field
   - Type "standard_user"
   - Press Tab
   - Type the password
   - Press Enter
5. Show me the test file
6. Run it to verify it works
```

### Example 2: Interactive Test Building

```
Let's build a test interactively:
1. Start a VM with debugger
2. I'll tell you what to do, and for each action:
   - Perform it
   - Append to tests/my-test.yaml
   - Take a screenshot
   - Wait for my next instruction
```

### Example 3: Generate JavaScript Test from Actions

```
Claude, perform these login actions and track them:
1. Connect to TestDriver
2. Navigate and complete login flow
3. Create a JavaScript test file from all actions at:
   testdriver/acceptance-sdk/auto-login.test.mjs
4. Run it with vitest
```

For more examples, see [VM_EXAMPLES.md](./VM_EXAMPLES.md)

## How It Works

1. **MCP Protocol**: The server implements the Model Context Protocol, allowing Claude to discover and invoke TestDriver methods as tools.

2. **SDK Integration**: Each tool maps directly to a TestDriver SDK method, providing access to AI-powered testing capabilities.

3. **Stateful Connection**: The server maintains a persistent connection to the TestDriver sandbox during a conversation, allowing multiple sequential commands.

4. **Error Handling**: Errors are captured and returned to Claude with helpful messages.

## Development

### Testing the Server

You can test the server locally:

```bash
cd mcp-server
TD_API_KEY=your-key node index.js
```

The server communicates via stdio, so you'll need an MCP client (like Claude Desktop) to interact with it.

### Adding New Tools

To add a new tool:

1. Add the tool definition to the `TOOLS` array in `index.js`
2. Add a case handler in the `executeTool` function
3. Update this README with documentation

## Troubleshooting

### Server Not Appearing in Claude

1. Check your configuration file path is correct
2. Verify the absolute path to `index.js` is accurate
3. Ensure `TD_API_KEY` is set in the environment
4. Restart Claude Desktop completely

### Connection Issues

1. Verify your API key is valid
2. Check network connectivity
3. Review error logs in Claude Desktop console

### Tool Execution Failures

1. Ensure you call `testdriver_connect` before other tools
2. Check timeout values for slow operations
3. Verify element descriptions are accurate

## License

ISC
