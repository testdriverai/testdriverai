# TestDriver MCP Server

MCP server that enables AI agents to iteratively build TestDriver tests with visual feedback.

## Features

- **Live Session Control**: Direct sandbox control via MCP tools
- **Visual Feedback**: Every action returns a screenshot with overlays (MCP Apps)
- **Inline Code Generation**: Each action returns the code to append to your test file
- **Assertions**: AI-powered assertions about screen state

## Installation

### Via npx (Recommended)

No installation needed! Just configure your MCP client to use npx:

```json
{
  "mcpServers": {
    "testdriver": {
      "command": "npx",
      "args": ["testdriverai-mcp"],
      "env": {
        "TD_API_KEY": "your-api-key"
      }
    }
  }
}
```

### From Source

```bash
cd mcp-server
npm install
npm run build
```

## Usage

### With Claude Desktop / Cursor

Add to your MCP config (`~/.cursor/mcp.json` or `~/Library/Application Support/Claude/claude_desktop_config.json`):

**Using npx (recommended):**

```json
{
  "mcpServers": {
    "testdriver": {
      "command": "npx",
      "args": ["testdriverai-mcp"],
      "env": {
        "TD_API_KEY": "your-api-key"
      }
    }
  }
}
```

**Using local build:**

```json
{
  "mcpServers": {
    "testdriver": {
      "command": "node",
      "args": ["/path/to/testdriverai/mcp-server/dist/server.js"],
      "env": {
        "TD_API_KEY": "your-api-key"
      }
    }
  }
}
```

### API Endpoint Configuration

The API endpoint can be configured in three ways (in order of precedence):

1. **Per-session**: Pass `apiRoot` to `session_start` tool
2. **Environment variable**: Set `TD_API_ROOT` in your MCP config
3. **Default**: `https://testdriver-api.onrender.com`

Common values:
- **Production**: `https://testdriver-api.onrender.com`
- **Local dev**: Your ngrok URL (e.g., `https://abc123.ngrok.io`)

### Self-Hosted AWS Instances

Connect to your own AWS-hosted Windows instances instead of using TestDriver cloud:

1. **Deploy AWS Infrastructure**: Use the [CloudFormation template](https://docs.testdriver.ai/v7/aws-setup) to set up VPC, security groups, and launch templates

2. **Spawn an instance**: Use `spawn-runner.sh` to launch an EC2 instance:
   ```bash
   AWS_REGION=us-east-2 \
   AMI_ID=ami-0504bf50fad62f312 \
   AWS_LAUNCH_TEMPLATE_ID=lt-xxx \
   bash setup/aws/spawn-runner.sh
   ```
   
3. **Connect via MCP**: Pass the IP to `session_start`:
   ```json
   {
     "type": "chrome",
     "url": "https://example.com",
     "os": "windows",
     "ip": "1.2.3.4"
   }
   ```

Or set `TD_IP` environment variable:
```json
{
  "mcpServers": {
    "testdriver": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/server.js"],
      "env": {
        "TD_API_KEY": "your-api-key",
        "TD_IP": "1.2.3.4"
      }
    }
  }
}
```

**Benefits of self-hosted:**
- Flat license fee (no device-second metering)
- Use your own AI API keys
- Custom hardware and software configurations
- Full RDP access for debugging

### Development

```bash
# Run in development mode with auto-reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Tools

### Session Management

| Tool | Description |
|------|-------------|
| `session_start` | Start a new session and provision sandbox |
| `session_status` | Check session health and time remaining |
| `session_extend` | Extend session keepAlive time |

### Element Interaction

| Tool | Description |
|------|-------------|
| `find` | Find element by natural language description |
| `click` | Click on element or coordinates |
| `find_and_click` | Find and click in one action |
| `type` | Type text into focused field |
| `press_keys` | Press keyboard shortcuts |
| `scroll` | Scroll the page |

### Verification

| Tool | Description |
|------|-------------|
| `assert` | AI-powered assertion about screen state |
| `exec` | Execute code in sandbox |
| `screenshot` | Capture screenshot |

## Workflow

1. **Start Session**: `session_start` provisions a sandbox with browser/app
2. **Interact**: Use `find`, `click`, `type` etc. - each action returns generated code
3. **Build Test**: Append the generated code from each action to your test file
4. **Assert**: Use `assert` to verify expected state
5. **Run Test**: Use the CLI (`npx vitest run <testFile>`) to run the test from scratch

Each tool returns a screenshot showing the result AND the code to add to your test file.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                 MCP Server                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │   Tools     │  │   Session   │  │  CodeGen   │  │
│  │  (find,     │  │  Manager    │  │  (inline   │  │
│  │   click,    │  │  (state,    │  │   code     │  │
│  │   type...)  │  │   expiry)   │  │   output)  │  │
│  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘  │
│         │                │               │         │
│         └────────────────┼───────────────┘         │
│                          │                         │
│  ┌───────────────────────┴───────────────────────┐ │
│  │              TestDriver SDK                   │ │
│  │         (sandbox control, AI vision)          │ │
│  └───────────────────────────────────────────────┘ │
│                          │                         │
└──────────────────────────┼─────────────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Sandbox    │
                    │  (VM + app)  │
                    └──────────────┘
```

## MCP Apps Integration

Every action tool returns a rich UI via MCP Apps showing:

- Screenshot of current screen
- Element highlights (for `find`)
- Click markers (for `click`)
- Scroll indicators (for `scroll`)
- Action status and duration
- Session info and time remaining
