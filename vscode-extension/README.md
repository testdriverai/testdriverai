# TestDriver.ai VSCode Extension

AI-powered end-to-end testing with live preview directly in your IDE.

## Features

- **Live Test Preview**: Watch your tests execute in real-time within VSCode
- **MCP Integration**: Automatic MCP server setup for AI-assisted test creation
- **Seamless Workflow**: Tests automatically open in a side panel when running

## Installation

### From VSIX

1. Download the `.vsix` file from releases
2. In VSCode, press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
3. Type "Install from VSIX" and select the downloaded file

### From Marketplace

Search for "TestDriver.ai" in the VSCode Extensions marketplace.

## Usage

### Live Preview

When running tests with the TestDriver SDK, set the `preview` option to `"ide"`:

```javascript
import { TestDriver } from 'testdriverai/lib/vitest/hooks.mjs';

describe('My Test Suite', () => {
  it('runs my test', async (context) => {
    const testdriver = TestDriver(context, {
      preview: 'ide'  // Opens live preview in IDE (VSCode, Cursor, etc.)
    });
    
    await testdriver.provision.chrome({ url: 'https://example.com' });
    await testdriver.find('Sign In button').click();
  });
});
```

### Preview Options

| Value | Description |
|-------|-------------|
| `"browser"` | Opens debugger in default browser (default) |
| `"ide"` | Opens debugger in IDE panel (VSCode, Cursor, etc.) |
| `"none"` | Headless mode, no preview |

### MCP Server

The extension can automatically install the TestDriver MCP server for AI-assisted test creation:

1. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. Type "TestDriver: Install MCP Server"
3. Choose where to save the configuration

Or accept the prompt when the extension first activates.

**Note:** When installed via this extension, the MCP server automatically uses IDE preview mode (`TD_PREVIEW=ide`), so the live test execution view opens directly in the IDE panel instead of an external browser.

## Commands

| Command | Description |
|---------|-------------|
| `TestDriver: Open Live Preview` | Manually open the preview panel |
| `TestDriver: Close Live Preview` | Close the preview panel |
| `TestDriver: Install MCP Server` | Install MCP server configuration |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `testdriverai.autoOpenPreview` | `true` | Auto-open preview when test starts |
| `testdriverai.mcpServerPath` | `""` | Custom MCP server path |

## Requirements

- VSCode 1.85.0 or later
- TestDriver.ai SDK installed in your project
- Valid TestDriver API key

## Getting Started

1. Install this extension
2. Get an API key at [console.testdriver.ai](https://console.testdriver.ai/team)
3. Set your `TD_API_KEY` environment variable
4. Run a test with `preview: "ide"` option

## License

MIT License - see LICENSE file for details.
