---
name: testdriver:provision
description: Launch browsers, desktop apps, and extensions in your sandbox
---
<!-- Generated from provision.mdx. DO NOT EDIT. -->

## Overview

The Provision API sets up applications in your sandbox before tests run. It handles downloading, installing, and launching browsers, desktop apps, VS Code, Chrome extensions, and more.

Access provision methods via `testdriver.provision.*`:

```javascript
await testdriver.provision.chrome({ url: 'https://example.com' });
```

<Note>
  When `reconnect: true` is set on the client, **all provision methods are skipped** since the application is assumed to already be running.
</Note>

## Methods

### chrome()

Launch Google Chrome with an optional URL.

```javascript
await testdriver.provision.chrome(options?)
```

<ParamField path="options" type="ProvisionChromeOptions">
  <Expandable title="properties">
    <ParamField path="url" type="string" default="http://testdriver-sandbox.vercel.app/">
      URL to navigate to after launch.
    </ParamField>
    
    <ParamField path="maximized" type="boolean" default={true}>
      Launch Chrome in maximized window mode.
    </ParamField>
    
    <ParamField path="guest" type="boolean" default={false}>
      Launch Chrome in guest profile mode.
    </ParamField>
  </Expandable>
</ParamField>

```javascript
// Basic
await testdriver.provision.chrome({ url: 'https://example.com' });

// With guest mode
await testdriver.provision.chrome({
  url: 'https://example.com',
  guest: true,
  maximized: true,
});
```

### chromeExtension()

Install and launch a Chrome extension. You can install from a local unpacked directory or from the Chrome Web Store by extension ID.

```javascript
await testdriver.provision.chromeExtension(options)
```

<ParamField path="options" type="ProvisionChromeExtensionOptions" required>
  One of `extensionPath` or `extensionId` is required.

  <Expandable title="properties">
    <ParamField path="extensionPath" type="string">
      Local path to an unpacked extension directory. The extension files are uploaded to the sandbox.
    </ParamField>
    
    <ParamField path="extensionId" type="string">
      Chrome Web Store extension ID to install.
    </ParamField>
    
    <ParamField path="maximized" type="boolean" default={true}>
      Launch Chrome in maximized window mode.
    </ParamField>
  </Expandable>
</ParamField>

```javascript
// From local directory
await testdriver.provision.chromeExtension({
  extensionPath: './my-extension',
});

// From Chrome Web Store
await testdriver.provision.chromeExtension({
  extensionId: 'abcdefghijklmnop',
});
```

### vscode()

Launch Visual Studio Code with an optional workspace and extensions.

```javascript
await testdriver.provision.vscode(options?)
```

<ParamField path="options" type="ProvisionVSCodeOptions">
  <Expandable title="properties">
    <ParamField path="workspace" type="string">
      Path to a workspace folder or `.code-workspace` file to open.
    </ParamField>
    
    <ParamField path="extensions" type="string[]" default={[]}>
      Array of VS Code extension IDs to install before launching.
    </ParamField>
  </Expandable>
</ParamField>

```javascript
await testdriver.provision.vscode({
  workspace: '/home/testdriver/project',
  extensions: ['ms-python.python', 'esbenp.prettier-vscode'],
});
```

### installer()

Download and run an application installer. Supports `.msi`, `.exe`, `.deb`, `.rpm`, `.appimage`, `.sh`, `.dmg`, and `.pkg` formats.

```javascript
await testdriver.provision.installer(options)
```

<ParamField path="options" type="ProvisionInstallerOptions" required>
  <Expandable title="properties">
    <ParamField path="url" type="string" required>
      Download URL for the installer.
    </ParamField>
    
    <ParamField path="filename" type="string">
      Override the auto-detected filename from the URL.
    </ParamField>
    
    <ParamField path="appName" type="string">
      Application name to focus after installation completes.
    </ParamField>
    
    <ParamField path="launch" type="boolean" default={true}>
      Whether to focus/launch the app after installation.
    </ParamField>
  </Expandable>
</ParamField>

**Behavior:**
- Downloads the installer from the URL
- Auto-detects the install method based on file extension
- Runs the appropriate install command (e.g., `msiexec` for `.msi`, `dpkg` for `.deb`)
- Optionally focuses the installed application

```javascript
// Windows MSI installer
await testdriver.provision.installer({
  url: 'https://example.com/app-setup.msi',
  appName: 'MyApp',
});

// Linux DEB package
await testdriver.provision.installer({
  url: 'https://example.com/app.deb',
  appName: 'MyApp',
  launch: true,
});
```

### electron()

Launch an Electron application.

```javascript
await testdriver.provision.electron(options)
```

<ParamField path="options" type="ProvisionElectronOptions" required>
  <Expandable title="properties">
    <ParamField path="appPath" type="string" required>
      Path to the Electron application directory or executable.
    </ParamField>
    
    <ParamField path="args" type="string[]" default={[]}>
      Additional command-line arguments to pass to the Electron app.
    </ParamField>
  </Expandable>
</ParamField>

```javascript
await testdriver.provision.electron({
  appPath: '/home/testdriver/my-electron-app',
  args: ['--no-sandbox'],
});
```

### dashcam()

Start Dashcam recording with custom options. Usually called automatically by other provision methods, but can be called directly for custom configurations.

```javascript
await testdriver.provision.dashcam(options?)
```

<ParamField path="options" type="ProvisionDashcamOptions">
  <Expandable title="properties">
    <ParamField path="logPath" type="string">
      Path to the TestDriver log file. Defaults to `/tmp/testdriver.log` (Linux) or `C:\Users\testdriver\testdriver.log` (Windows).
    </ParamField>
    
    <ParamField path="logName" type="string" default="TestDriver Log">
      Display name for the log file in the Dashcam replay.
    </ParamField>
    
    <ParamField path="webLogs" type="boolean" default={true}>
      Enable web traffic log capture.
    </ParamField>
    
    <ParamField path="title" type="string">
      Recording title for the Dashcam session.
    </ParamField>
  </Expandable>
</ParamField>

```javascript
await testdriver.provision.dashcam({
  title: 'Login Flow Test',
  logPath: '/tmp/my-app.log',
  logName: 'Application Log',
  webLogs: true,
});
```

## Reconnect Behavior

When `reconnect: true` is set on the client, all provision methods are wrapped in a Proxy that intercepts calls and skips them silently. This is because when reconnecting to an existing sandbox, the applications are already running.

```javascript
const testdriver = new TestDriver({
  reconnect: true,
});

await testdriver.ready();

// These calls are silently skipped:
await testdriver.provision.chrome({ url: 'https://example.com' });
await testdriver.provision.dashcam();
```

## Types

```typescript
interface ProvisionChromeOptions {
  url?: string;                    // Default: "http://testdriver-sandbox.vercel.app/"
  maximized?: boolean;             // Default: true
  guest?: boolean;                 // Default: false
}

interface ProvisionChromeExtensionOptions {
  extensionPath?: string;          // Local unpacked extension path
  extensionId?: string;            // Chrome Web Store ID
  maximized?: boolean;             // Default: true
}

interface ProvisionVSCodeOptions {
  workspace?: string;              // Workspace path
  extensions?: string[];           // Extension IDs to install
}

interface ProvisionInstallerOptions {
  url: string;                     // Download URL (required)
  filename?: string;               // Override filename
  appName?: string;                // App name to focus
  launch?: boolean;                // Default: true
}

interface ProvisionElectronOptions {
  appPath: string;                 // Path to Electron app (required)
  args?: string[];                 // Additional args
}

interface ProvisionDashcamOptions {
  logPath?: string;                // Log file path
  logName?: string;                // Default: "TestDriver Log"
  webLogs?: boolean;               // Default: true
  title?: string;                  // Recording title
}
```

## Complete Example

```javascript
import { describe, it, beforeAll, afterAll } from 'vitest';
import TestDriver from 'testdriverai';

describe('Chrome Extension Test', () => {
  let testdriver;

  beforeAll(async () => {
    testdriver = new TestDriver({
      os: 'linux',
      resolution: '1920x1080',
    });
    
    await testdriver.ready();
    
    // Install extension and open Chrome
    await testdriver.provision.chromeExtension({
      extensionPath: './my-extension',
    });
    
    // Start Dashcam with custom logs
    await testdriver.provision.dashcam({
      title: 'Extension Test',
      webLogs: true,
    });
  });

  afterAll(async () => {
    await testdriver.disconnect();
  });

  it('tests the extension popup', async () => {
    await testdriver.find('extension icon').click();
    await testdriver.find('popup content').click();
  });
});
```
