# Deployment Guide

## Building the MCP Server

```bash
cd mcp-server
npm install
npm run build
```

This will compile the TypeScript source in `src/` to JavaScript in `dist/`.

## Deploying to ~/.mcp/testdriver

To update the MCP server in the global location:

```bash
# Build the server
cd mcp-server
npm run build

# Copy to global MCP location
rm -rf ~/.mcp/testdriver
mkdir -p ~/.mcp/testdriver
cp -r dist package.json package-lock.json node_modules ~/.mcp/testdriver/

# Or create a symlink for development
rm -rf ~/.mcp/testdriver
ln -s "$(pwd)" ~/.mcp/testdriver
```

## Configuration Locations

The MCP server can be configured in various locations depending on your MCP client:

### Claude Desktop / Cline

`~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

```json
{
  "mcpServers": {
    "testdriverai": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/.mcp/testdriver/dist/index.js"],
      "env": {
        "TESTDRIVER_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### VS Code (workspace-specific)

`.vscode/mcp.json` in your workspace:

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

### Other MCP Clients

Check your client's documentation for MCP server configuration.

## Verification

After deploying, restart your MCP client and verify the server is available:

1. The server should appear in your MCP client's tools list
2. Try calling `testdriver_connect` with your API key
3. Check the server responds correctly

## Development Workflow

For active development:

```bash
# Watch mode - rebuilds on file changes
npm run dev

# Make changes to src/index.ts
# The TypeScript compiler will automatically rebuild

# Restart your MCP client to load the new version
```

## Troubleshooting

**Server not found:**
- Check the path in your MCP configuration
- Ensure `dist/index.js` exists (run `npm run build`)
- Restart your MCP client

**Import errors:**
- Run `npm install` in the mcp-server directory
- Check that `testdriverai` package is installed in parent directory

**Connection issues:**
- Verify your API key is set correctly
- Check the TestDriver API is accessible
- Look for error messages in your MCP client's logs
