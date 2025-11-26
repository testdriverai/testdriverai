# Testing the TestDriver MCP Server

## Quick Test

### 1. Build the Server

```bash
cd mcp-server
npm install
npm run build
```

### 2. Test Server Starts

```bash
# Should output: "TestDriver MCP server running on stdio"
node dist/index.js
# Press Ctrl+C to stop
```

### 3. Install for Your MCP Client

```bash
# Deploy to ~/.mcp/testdriver
npm run deploy
```

## Testing with an MCP Client

### Option 1: VS Code with Cline/Claude Dev

1. **Update MCP configuration**

Edit `.vscode/mcp.json` (already updated):
```json
{
  "servers": {
    "testdriverai": {
      "type": "stdio",
      "command": "node",
      "args": ["/Users/ianjennings/Development/cli/mcp-server/dist/index.js"]
    }
  }
}
```

2. **Restart VS Code** or reload the window

3. **Open Cline/Claude** and check if TestDriver tools appear

4. **Test the connection**:
```
User: "Connect to TestDriver with API key td-xxx-yyy-zzz"
AI should call: testdriver_connect({ apiKey: "..." })
```

### Option 2: Claude Desktop

1. **Edit Claude config**:
```bash
# macOS
code ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Add:
{
  "mcpServers": {
    "testdriverai": {
      "command": "node",
      "args": ["/Users/ianjennings/Development/cli/mcp-server/dist/index.js"]
    }
  }
}
```

2. **Restart Claude Desktop**

3. **Test**: Ask Claude to "Connect to TestDriver"

### Option 3: Manual Testing with MCP Inspector

Install the MCP Inspector:
```bash
npx @modelcontextprotocol/inspector dist/index.js
```

This opens a web UI where you can:
- See all available tools
- Call tools manually
- View responses

## Testing the Full Workflow

### End-to-End Test

1. **Start a chat with your MCP client**

2. **Provide API key**:
```
"Create a test for the login page at http://testdriver-sandbox.vercel.app/login"
```

3. **AI should**:
   - Call `testdriver_connect({ apiKey: "..." })`
   - Share the debugger URL with you
   - Take screenshots
   - Find elements
   - Interact with them
   - Generate Vitest test code
   - Save the test file

4. **Verify**:
   - Check the debugger URL works
   - Review the generated test file
   - Run the test: `npx vitest run path/to/test.test.mjs`

## Troubleshooting

### Server Won't Start

```bash
# Check for syntax errors
npm run build

# Check the output
node dist/index.js
```

### Tools Not Appearing

```bash
# Verify the server is registered
# Check your MCP client's logs

# For VS Code, check Output panel → select your MCP extension
# For Claude Desktop, check ~/.config/Claude/logs/
```

### Connection Fails

```bash
# Test with a real API key
node -e "
const TestDriver = require('testdriverai');
const client = new TestDriver('your-api-key');
client.connect().then(() => console.log('OK')).catch(console.error);
"
```

### Can't Find testdriverai Package

```bash
# Make sure you're in the cli directory and testdriverai is installed
cd /Users/ianjennings/Development/cli
npm link

# Then in mcp-server
cd mcp-server
npm link testdriverai
```

Or install from parent:
```bash
cd mcp-server
npm install ../
```

## Development Workflow

### Watch Mode

```bash
# Terminal 1: Watch TypeScript compilation
cd mcp-server
npm run dev

# Terminal 2: Test changes
node dist/index.js
```

### Testing Individual Tools

Create a test script:

```javascript
// test-mcp.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
});

const client = new Client({
  name: "test-client",
  version: "1.0.0",
}, {
  capabilities: {}
});

await client.connect(transport);

// List tools
const tools = await client.listTools();
console.log("Available tools:", tools.tools.map(t => t.name));

// Test connect
const result = await client.callTool({
  name: "testdriver_connect",
  arguments: {
    apiKey: process.env.TESTDRIVER_API_KEY
  }
});

console.log("Connect result:", result);

await client.close();
```

Run:
```bash
TESTDRIVER_API_KEY=your-key node test-mcp.mjs
```

## Verifying the Build

```bash
# Check compiled output exists
ls -la dist/
# Should see: index.js, index.d.ts, etc.

# Check for errors
cat dist/index.js | head -50

# Verify imports work
node -e "import('./dist/index.js').catch(console.error)"
```

## Live Testing with a User

1. **Share this with a user**:
   ```
   I have a TestDriver MCP server that can help you create Vitest tests.
   
   Please provide your TestDriver API key from:
   https://v6.testdriver.ai/settings
   ```

2. **User provides key**

3. **Connect**: 
   ```
   testdriver_connect({ apiKey: "user-key" })
   ```

4. **Share debugger URL** from response

5. **Create a test** based on their request

6. **Save test file** to their project

## Example Test Session

```bash
# 1. Start
cd mcp-server
npm run build

# 2. Test server
node dist/index.js
# Should output: "TestDriver MCP server running on stdio"
# Ctrl+C

# 3. Deploy
npm run deploy

# 4. Update VS Code config to point to deployed server
# Edit .vscode/mcp.json to use ~/.mcp/testdriver/dist/index.js

# 5. Restart VS Code

# 6. Open Cline/Claude and test:
"Connect to TestDriver with my API key and create a login test"
```

## Continuous Testing

Set up a test script in package.json:

```json
{
  "scripts": {
    "test": "node test/verify-server.mjs"
  }
}
```

Create `test/verify-server.mjs`:
```javascript
import { spawn } from 'child_process';

console.log('Testing MCP server...');

const server = spawn('node', ['dist/index.js']);

server.stderr.on('data', (data) => {
  const output = data.toString();
  if (output.includes('TestDriver MCP server running')) {
    console.log('✅ Server started successfully');
    server.kill();
    process.exit(0);
  }
});

setTimeout(() => {
  console.log('❌ Server did not start in time');
  server.kill();
  process.exit(1);
}, 5000);
```

Run:
```bash
npm test
```

## Next Steps

After successful testing:

1. ✅ Server builds and starts
2. ✅ Tools appear in MCP client
3. ✅ Can connect to TestDriver
4. ✅ Can create and save tests

You're ready to use the MCP server for interactive test creation!
