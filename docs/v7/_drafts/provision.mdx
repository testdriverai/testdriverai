# Provision API

The `provision()` function is the easiest way to set up TestDriver for common applications. It automatically handles TestDriver initialization, application launching, and Dashcam recording.

## Quick Start

```javascript
import { test } from 'vitest';
import { provision } from 'testdriverai/presets';

test('my test', async (context) => {
  const { testdriver } = await provision('chrome', {
    url: 'https://example.com'
  }, context);
  
  await testdriver.find('Login button').click();
});
```

## API

```typescript
provision(appType, options, context)
```

**Parameters:**
- `appType` - Application type: `'chrome'`, `'vscode'`, `'electron'`, or `'webapp'`
- `options` - Configuration options (varies by app type)
- `context` - Vitest test context (from your test function parameter)

**Returns:**
- `testdriver` - TestDriver instance ready to use
- `dashcam` - Dashcam instance (if enabled)
- Additional app-specific properties (like `vscode`, `app`)

## Application Types

### Chrome Browser

```javascript
const { testdriver } = await provision('chrome', {
  url: 'https://myapp.com',
  maximized: true,      // Start maximized (default: true)
  guest: true,          // Use guest mode (default: true)
  dashcam: true,        // Enable Dashcam (default: true)
  os: 'linux'          // Target OS (default: 'linux')
}, context);

await testdriver.find('username').type('user@example.com');
await testdriver.find('Login').click();
```

**Options:**
- `url` - URL to navigate to (default: 'http://testdriver-sandbox.vercel.app/')
- `maximized` - Start browser maximized (default: `true`)
- `guest` - Use guest/incognito mode (default: `true`)
- `dashcam` - Enable Dashcam recording (default: `true`)
- `os` - Target OS: `'linux'`, `'mac'`, or `'windows'` (default: `'linux'`)

**Returns:**
- `testdriver` - TestDriver instance
- `dashcam` - Dashcam instance (if enabled)

### VS Code

```javascript
const { testdriver, vscode } = await provision('vscode', {
  workspace: '/path/to/project',
  extensions: ['ms-python.python'],
  dashcam: true,
  os: 'linux'
}, context);

await vscode.find('File menu').click();
await vscode.find('New File').click();
```

**Options:**
- `workspace` - Workspace/folder path to open (optional)
- `extensions` - Array of extension IDs to install (optional)
- `dashcam` - Enable Dashcam recording (default: `true`)
- `os` - Target OS (default: `'linux'`)

**Returns:**
- `testdriver` - TestDriver instance
- `vscode` - Alias for testdriver (semantic clarity)
- `dashcam` - Dashcam instance (if enabled)

### Electron

```javascript
const { testdriver, app } = await provision('electron', {
  appPath: '/path/to/app',
  args: ['--enable-logging'],
  dashcam: true,
  os: 'linux'
}, context);

await app.find('main window').click();
```

**Options:**
- `appPath` - Path to Electron application (required)
- `args` - Additional command-line arguments (optional)
- `dashcam` - Enable Dashcam recording (default: `true`)
- `os` - Target OS (default: `'linux'`)

**Returns:**
- `testdriver` - TestDriver instance
- `app` - Alias for testdriver (semantic clarity)
- `dashcam` - Dashcam instance (if enabled)

### Web App

Generic wrapper for web applications (currently uses Chrome):

```javascript
const { testdriver } = await provision('webapp', {
  url: 'https://example.com',
  browser: 'chrome'  // Only 'chrome' supported currently
}, context);
```

## Complete Example

```javascript
import { describe, it, expect } from 'vitest';
import { provision } from 'testdriverai/presets';

describe('Login Flow', () => {
  it('should login successfully', async (context) => {
    // Provision Chrome with your app
    const { testdriver, dashcam } = await provision('chrome', {
      url: 'https://myapp.com/login',
      maximized: true
    }, context);
    
    // Interact with the application
    await testdriver.find('email input').type('user@example.com');
    await testdriver.find('password input').type('password123');
    await testdriver.find('Login button').click();
    
    // Verify results
    const result = await testdriver.assert('Welcome message is visible');
    expect(result).toBeTruthy();
    
    // Dashcam automatically stops and saves replay at test end
    // No cleanup needed - handled automatically!
  });
});
```

## How It Works

When you call `provision()`:

1. **Creates TestDriver client** - Initializes and connects to sandbox
2. **Sets up Dashcam** - Authenticates and starts recording (if enabled)
3. **Launches application** - Opens the specified app with your configuration
4. **Focuses window** - Ensures the app is ready for interaction
5. **Returns ready-to-use instances** - Everything is set up and ready

At test end:
- Dashcam automatically stops and saves replay URL
- TestDriver automatically disconnects
- All cleanup is handled for you

## Automatic Lifecycle

The `provision()` function uses Vitest hooks under the hood to manage the entire lifecycle:

```javascript
// ✅ This:
const { testdriver } = await provision('chrome', { url }, context);

// Is equivalent to manually doing:
const client = new TestDriver(apiKey, { os: 'linux' });
await client.auth();
await client.connect();

const dashcam = new Dashcam(client);
await dashcam.auth();
await dashcam.start();

await client.exec('sh', 'google-chrome --start-maximized --guest "https://example.com" &', 30000);
await client.focusApplication('Google Chrome');

// ... your test code ...

await dashcam.stop();
await client.disconnect();
```

That's **15+ lines of boilerplate** reduced to **1 line**!

## TypeScript Support

Full TypeScript definitions included:

```typescript
import { provision } from 'testdriverai/presets';

test('typed test', async (context) => {
  const { testdriver } = await provision('chrome', {
    url: 'https://example.com',
    maximized: true,
    os: 'linux' // ✅ Type-safe: only 'linux' | 'mac' | 'windows'
  }, context);
  
  // ✅ Full autocomplete for testdriver methods
  await testdriver.find('button').click();
});
```

## Direct Preset Functions

You can also use the individual preset functions directly:

```javascript
import { chrome, vscode, electron } from 'testdriverai/presets';

// Same as provision('chrome', options, context)
const { testdriver } = await chrome(context, {
  url: 'https://example.com'
});

// Same as provision('vscode', options, context)
const { vscode } = await vscode(context, {
  workspace: '/path/to/project'
});
```

These are available for when you prefer explicit function names.

## Best Practices

1. **Always pass context** - Required for automatic cleanup
2. **Enable dashcam** - Great for debugging test failures
3. **Use descriptive variables** - `testdriver`, `vscode`, `app` based on what you're testing
4. **Leverage TypeScript** - Get autocomplete and type safety
5. **Keep URLs in config** - Use environment variables for different environments

## Error Handling

```javascript
test('handles errors gracefully', async (context) => {
  try {
    const { testdriver } = await provision('chrome', {
      url: 'https://example.com'
    }, context);
    
    await testdriver.find('button').click();
  } catch (error) {
    // Cleanup still happens automatically
    console.error('Test failed:', error);
    throw error; // Re-throw to mark test as failed
  }
});
```

## See Also

- [Hooks API](./HOOKS.md) - For more control over lifecycle
- [Core Classes](./CORE.md) - For full manual control
- [Migration Guide](../MIGRATION.md) - Upgrading from v6
- [Examples](../../testdriver/acceptance-sdk/presets-example.test.mjs) - Working examples
