# TestDriver Presets

Presets provide pre-configured setups for common applications, reducing boilerplate and making your tests easier to write.

## Available Presets

### chromePreset

Automatically sets up Chrome browser with TestDriver and Dashcam.

```javascript
import { test } from 'vitest';
import { chromePreset } from 'testdriverai/presets';

test('my test', async (context) => {
  const { browser } = await chromePreset(context, {
    url: 'https://myapp.com/login'
  });
  
  await browser.find('email input').type('user@example.com');
  await browser.find('Login button').click();
});
```

**Options:**
- `url` - URL to navigate to (default: 'http://testdriver-sandbox.vercel.app/')
- `os` - Target OS: 'linux', 'mac', 'windows' (default: 'linux')
- `dashcam` - Enable Dashcam recording (default: true)
- `maximized` - Start maximized (default: true)
- `guest` - Use guest mode (default: true)

**Returns:**
- `client` - TestDriver instance
- `browser` - Alias for client (semantic clarity)
- `dashcam` - Dashcam instance (if enabled)

### vscodePreset

Automatically sets up VS Code with TestDriver and Dashcam.

```javascript
import { vscodePreset } from 'testdriverai/presets';

test('extension test', async (context) => {
  const { vscode } = await vscodePreset(context, {
    workspace: '/tmp/test-project',
    extensions: ['ms-python.python']
  });
  
  await vscode.find('File menu').click();
  await vscode.find('New File').click();
});
```

**Options:**
- `workspace` - Workspace/folder to open
- `os` - Target OS (default: 'linux')
- `dashcam` - Enable Dashcam recording (default: true)
- `extensions` - Array of extension IDs to install

**Returns:**
- `client` - TestDriver instance
- `vscode` - Alias for client
- `dashcam` - Dashcam instance (if enabled)

### electronPreset

Automatically sets up an Electron application.

```javascript
import { electronPreset } from 'testdriverai/presets';

test('electron app test', async (context) => {
  const { app } = await electronPreset(context, {
    appPath: '/path/to/electron/app',
    args: ['--enable-logging']
  });
  
  await app.find('main window').click();
});
```

**Options:**
- `appPath` - Path to Electron app (required)
- `os` - Target OS (default: 'linux')
- `dashcam` - Enable Dashcam recording (default: true)
- `args` - Additional electron arguments

**Returns:**
- `client` - TestDriver instance
- `app` - Alias for client
- `dashcam` - Dashcam instance (if enabled)

### webAppPreset

Generic web application preset (currently uses Chrome).

```javascript
import { webAppPreset } from 'testdriverai/presets';

test('web app test', async (context) => {
  const { browser } = await webAppPreset(context, {
    url: 'https://example.com',
    browser: 'chrome' // Only Chrome supported currently
  });
  
  await browser.find('login form').click();
});
```

## Creating Custom Presets

Use `createPreset` to build your own presets:

```javascript
import { createPreset } from 'testdriverai/presets';

const firefoxPreset = createPreset({
  name: 'Firefox Browser',
  defaults: { os: 'linux', dashcam: true },
  async setup(context, client, dashcam, options) {
    const { url } = options;
    
    // Launch Firefox
    await client.exec('sh', `firefox "${url}" >/dev/null 2>&1 &`, 30000);
    await client.focusApplication('Firefox');
    
    return {
      browser: client,
    };
  },
});

// Use your custom preset
test('my test', async (context) => {
  const { browser } = await firefoxPreset(context, {
    url: 'https://example.com',
  });
  
  await browser.find('page content').click();
});
```

### createPreset API

```javascript
createPreset({
  name: string,           // Preset name (for errors)
  defaults: object,       // Default options
  setup: async function   // Setup function
})
```

The `setup` function receives:
- `context` - Vitest test context
- `client` - TestDriver instance (already connected)
- `dashcam` - Dashcam instance (if enabled)
- `options` - Merged defaults + user options

The `setup` function should return an object with any custom properties. The returned object will automatically include `client` and `dashcam`.

## How Presets Work

Presets automatically:

1. **Create TestDriver client** - Uses `useTestDriver` hook
2. **Connect to sandbox** - Authenticates and connects
3. **Set up Dashcam** - If enabled (default: true)
4. **Configure application** - Launch and focus the app
5. **Handle cleanup** - Automatic disconnect and dashcam stop

All lifecycle is managed automatically via Vitest hooks.

## Progressive Disclosure

Presets fit into the progressive disclosure pattern:

### Beginner (Presets)
```javascript
const { browser } = await chromePreset(context, { url: 'https://example.com' });
```
Everything automatic - just pass URL and start testing.

### Intermediate (Hooks)
```javascript
const client = useTestDriver(context, { os: 'linux' });
const dashcam = useDashcam(context, client, { autoStart: true });
// Custom setup code
```
More control over lifecycle, still automatic cleanup.

### Advanced (Direct)
```javascript
const client = new TestDriver(apiKey, { os: 'linux' });
await client.auth();
await client.connect();
// Full manual control
```
Complete control, manual everything.

## Best Practices

1. **Use presets for common scenarios** - Chrome, VS Code, Electron
2. **Create custom presets for your apps** - Encapsulate setup logic
3. **Enable dashcam by default** - Great for debugging failures
4. **Keep presets focused** - One app/scenario per preset
5. **Return semantic aliases** - `browser`, `vscode`, `app` instead of just `client`

## Examples

See `testdriver/acceptance-sdk/presets-example.test.mjs` for working examples.
