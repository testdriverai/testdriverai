# TestDriver SDK & Plugin Design - Optimal Architecture

## Executive Summary

This document outlines the optimal SDK and plugin structure for TestDriver, designed to enable developers to add test automation to their applications with flexibility for both quick-start scenarios and advanced configurations.

**Key Principles:**
1. **Progressive Disclosure**: Simple by default, powerful when needed
2. **Convention over Configuration**: Smart defaults for 90% use cases
3. **Composability**: Building blocks that can be mixed and matched
4. **Framework-First**: Vitest plugin as the primary interface, with standalone SDK support
5. **Type Safety**: Full TypeScript support for better DX

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Layer 1: Core SDK](#layer-1-core-sdk)
3. [Layer 2: Vitest Plugin](#layer-2-vitest-plugin)
4. [Layer 3: Presets & Helpers](#layer-3-presets--helpers)
5. [Configuration System](#configuration-system)
6. [Usage Examples](#usage-examples)
7. [Migration Path](#migration-path)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Layer 3: Presets                         │
│  Chrome Web Presets | VSCode Presets | Custom App Presets  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                 Layer 2: Vitest Plugin                      │
│  Auto-lifecycle | Test Recording | Dashcam Integration     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Layer 1: Core SDK                         │
│  TestDriver Client | Sandbox | Dashcam | Element API       │
└─────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Core SDK

### 1.1 TestDriver Class (Core Client)

**Purpose**: Low-level SDK for direct programmatic control

```typescript
interface TestDriverOptions {
  apiKey?: string;              // Can be omitted if using env var
  apiRoot?: string;             // Default: production API
  os?: 'linux' | 'windows' | 'mac';
  resolution?: string;
  cache?: boolean;
  analytics?: boolean;
  
  // Advanced sandbox options
  sandbox?: {
    ami?: string;
    instance?: string;
    ip?: string;
    headless?: boolean;
  };
}

class TestDriver {
  constructor(apiKey?: string, options?: TestDriverOptions);
  
  // Core lifecycle
  async auth(): Promise<void>;
  async connect(options?: ConnectOptions): Promise<SandboxInstance>;
  async disconnect(): Promise<void>;
  
  // Element API (modern, recommended)
  async find(description: string): Promise<Element>;
  async findAll(description: string): Promise<Element[]>;
  
  // Element operations
  async click(x: number, y: number): Promise<void>;
  async type(text: string): Promise<void>;
  async pressKeys(keys: string[]): Promise<void>;
  async scroll(direction: Direction, amount: number): Promise<void>;
  
  // AI operations
  async ai(prompt: string): Promise<void>;
  async assert(expectation: string): Promise<boolean>;
  async remember(query: string): Promise<string>;
  
  // System operations
  async exec(shell: string, command: string, timeout?: number): Promise<string>;
  async focusApplication(name: string): Promise<void>;
  
  // State & utilities
  getSessionId(): string;
  getInstance(): SandboxInstance;
  getEmitter(): EventEmitter;
}
```

### 1.2 Dashcam Module (Separate, Composable)

```typescript
interface DashcamOptions {
  apiKey?: string;
  autoStart?: boolean;
  logs?: LogConfig[];
}

interface LogConfig {
  name: string;
  type: 'file' | 'stdout' | 'application';
  path?: string;
  application?: string;
}

class Dashcam {
  constructor(client: TestDriver, options?: DashcamOptions);
  
  async auth(apiKey?: string): Promise<void>;
  async addLog(config: LogConfig): Promise<void>;
  async start(): Promise<void>;
  async stop(): Promise<string | null>; // Returns replay URL
  async isRecording(): Promise<boolean>;
  
  // Convenience methods
  async addFileLog(path: string, name: string): Promise<void>;
  async addApplicationLog(app: string, name: string): Promise<void>;
}
```

### 1.3 Element Class (Enhanced)

```typescript
class Element {
  // Properties
  readonly description: string;
  readonly x: number | null;
  readonly y: number | null;
  readonly centerX: number | null;
  readonly centerY: number | null;
  readonly found: boolean;
  
  // Actions
  async click(): Promise<void>;
  async doubleClick(): Promise<void>;
  async rightClick(): Promise<void>;
  async hover(): Promise<void>;
  async dragTo(target: Element | {x: number, y: number}): Promise<void>;
  
  // Queries
  async getText(): Promise<string>;
  async isVisible(): Promise<boolean>;
  async waitUntilVisible(timeout?: number): Promise<void>;
  
  // Utilities
  found(): boolean;
  getDebugInfo(): DebugInfo;
  async saveScreenshot(path?: string): Promise<string>;
}
```

---

## Layer 2: Vitest Plugin

### 2.1 Plugin Architecture

The Vitest plugin provides automatic lifecycle management and test recording.

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import testdriver from 'testdriverai/vitest';

export default defineConfig({
  plugins: [
    testdriver({
      // API configuration
      apiKey: process.env.TD_API_KEY,
      apiRoot: process.env.TD_API_ROOT,
      
      // Lifecycle mode
      mode: 'auto',  // 'auto' | 'manual' | 'hybrid'
      
      // Dashcam configuration
      dashcam: {
        enabled: true,
        scope: 'test',  // 'test' | 'file' | 'suite' | 'run'
        autoStart: true,
        logs: [
          { type: 'file', path: '/tmp/app.log', name: 'App Log' }
        ]
      },
      
      // Application presets
      preset: 'chrome',  // 'chrome' | 'vscode' | 'custom' | null
      
      // Custom launch configuration
      launch: {
        application: 'Google Chrome',
        url: 'https://myapp.com',
        waitFor: 'Login page is visible'
      },
      
      // Platform
      os: 'linux',  // 'linux' | 'windows' | 'mac'
      
      // Test recording
      recording: {
        enabled: true,
        includeScreenshots: true,
        includeLogs: true
      }
    })
  ]
});
```

### 2.2 Lifecycle Modes

**Quick Comparison:**

| Feature | Auto Mode | Hybrid Mode | Manual Mode |
|---------|-----------|-------------|-------------|
| **Who it's for** | Quick start, standard apps | Power users, custom apps | Full control, any framework |
| **Setup complexity** | Minimal (1 line) | Medium (selective overrides) | High (all boilerplate) |
| **Sandbox lifecycle** | ✅ Auto | ✅ Auto | ❌ You manage |
| **App launch** | ✅ Auto (via preset) | ⚙️ You customize | ❌ You manage |
| **Dashcam start/stop** | ✅ Auto (per test) | ⚙️ Customizable scope | ❌ You manage |
| **Test recording** | ✅ Auto | ✅ Auto | ❌ You manage |
| **Cleanup** | ✅ Auto | ✅ Auto | ❌ You manage |
| **Code in tests** | Minimal | Medium | Maximum |
| **Flexibility** | Low | High | Maximum |

#### Auto Mode (Default - 90% Use Case)
Handles everything automatically:
- Creates sandbox before each test file
- Authenticates dashcam
- Launches application
- Starts recording per test
- Stops recording and uploads
- Cleans up after tests

```typescript
// tests/login.test.ts
import { describe, it, expect } from 'vitest';
import { useTestDriver } from 'testdriverai/vitest';

describe('Login Flow', () => {
  const td = useTestDriver();  // Auto-configured!
  
  it('should login successfully', async () => {
    const email = await td.find('Email input');
    await email.click();
    await td.type('user@example.com');
    
    const submit = await td.find('Submit button');
    await submit.click();
    
    expect(await td.assert('Dashboard is visible')).toBe(true);
  });
});
```

#### Manual Mode (Advanced - Full Control)
User manages all lifecycle:

```typescript
import { describe, it, beforeAll, afterAll } from 'vitest';
import { createTestDriver, createDashcam } from 'testdriverai';

describe('Custom Lifecycle', () => {
  let td: TestDriver;
  let dashcam: Dashcam;
  
  beforeAll(async () => {
    td = createTestDriver();
    await td.auth();
    await td.connect();
    
    dashcam = createDashcam(td);
    await dashcam.auth();
  });
  
  beforeEach(async () => {
    await dashcam.start();
  });
  
  afterEach(async () => {
    const url = await dashcam.stop();
    console.log('Recording:', url);
  });
  
  afterAll(async () => {
    await td.disconnect();
  });
  
  it('custom test', async () => {
    // Your test
  });
});
```

#### Hybrid Mode (Recommended for Power Users)

**What it is**: Start with auto mode's convenience, but selectively override specific behaviors where you need custom control.

**When to use**: When you need the plugin to handle most lifecycle (sandbox creation, cleanup, test recording) but want to customize specific parts like:
- Custom application launch sequence
- Special dashcam configuration
- Pre-test setup that's unique to your app
- Different recording scope (file vs test)

**How it works**: Use the convenience hooks (`useTestDriver`, `useDashcam`) but pass options to disable/customize specific auto behaviors.

```typescript
import { describe, it, beforeAll } from 'vitest';
import { useTestDriver, useDashcam } from 'testdriverai/vitest';

describe('Hybrid Mode Example', () => {
  // Plugin handles: sandbox creation, auth, cleanup
  // We customize: launch and dashcam scope
  const td = useTestDriver({
    autoConnect: true,   // ✅ Plugin auto-connects sandbox
    autoLaunch: false    // ❌ We'll launch manually
  });
  
  const dashcam = useDashcam({
    scope: 'file',  // Override: record entire file, not per-test
    logs: [
      { type: 'file', path: '/custom/path.log', name: 'My Log' }
    ]
  });
  
  beforeAll(async () => {
    // Custom launch sequence for our specific app
    await td.exec('sh', './scripts/setup-test-env.sh');
    await td.exec('sh', './scripts/start-app.sh');
    await td.wait(5000);
  });
  
  it('should work', async () => {
    // Test normally - dashcam auto-started at file level
    const btn = await td.find('Button');
    await btn.click();
  });
});
```

**Real-world example**: Testing a desktop app that needs special setup

```typescript
describe('Electron App Tests', () => {
  const td = useTestDriver({
    autoConnect: true,      // ✅ Let plugin handle sandbox
    autoLaunch: false,      // ❌ Custom electron launch
  });
  
  const dashcam = useDashcam({
    scope: 'suite',         // Override: one recording for entire suite
    logs: [
      { type: 'file', path: '/tmp/electron.log', name: 'App Log' },
      { type: 'file', path: '/tmp/renderer.log', name: 'Renderer Log' }
    ]
  });
  
  beforeAll(async () => {
    // Custom: Build and launch Electron app
    await td.exec('sh', 'npm run build');
    await td.exec('sh', 'npm run start', 60000);
    await td.wait(10000);  // Wait for app to fully load
  });
  
  it('test 1', async () => {
    // Plugin auto-started dashcam at suite level
    // No need to manually start/stop per test
    const menu = await td.find('File menu');
    await menu.click();
  });
  
  it('test 2', async () => {
    // Same recording continues
    const newFile = await td.find('New File button');
    await newFile.click();
  });
  
  // Plugin auto-stops dashcam and cleans up after suite
});
```

**Comparison**:

| What Happens | Auto Mode | Hybrid Mode | Manual Mode |
|--------------|-----------|-------------|-------------|
| Sandbox creation | ✅ Plugin | ✅ Plugin | ❌ You write |
| Sandbox cleanup | ✅ Plugin | ✅ Plugin | ❌ You write |
| App launch | ✅ Plugin (preset) | ⚙️ You customize | ❌ You write |
| Dashcam start/stop | ✅ Plugin (per test) | ⚙️ You customize scope | ❌ You write |
| Test recording | ✅ Plugin | ✅ Plugin | ❌ You write |

✅ = Automatic, ⚙️ = Customizable, ❌ = Your responsibility

### 2.3 Plugin Hooks System

```typescript
// Expose hooks for custom behavior
import { onBeforeConnect, onAfterConnect, onTestComplete } from 'testdriverai/vitest';

onBeforeConnect(async (client) => {
  // Custom setup before sandbox connection
  console.log('Connecting to sandbox...');
});

onAfterConnect(async (client) => {
  // Custom setup after connection
  await client.exec('sh', 'install-dependencies.sh');
});

onTestComplete(async (client, result) => {
  // Custom cleanup or reporting
  if (result.status === 'failed') {
    await client.screenshot('failure.png');
  }
});
```

---

## Layer 3: Presets & Helpers

### 3.1 Application Presets

Presets are pre-configured bundles for common applications.

```typescript
// Built-in presets
import { chromePreset, vscodePreset, figmaPreset } from 'testdriverai/presets';

// Chrome preset
const chrome = chromePreset({
  url: 'https://myapp.com',
  waitFor: 'Page loaded',
  profile: 'guest',  // 'guest' | 'default' | 'custom'
  windowSize: 'maximized',
  logs: true  // Auto-configure console logs
});

// VSCode preset
const vscode = vscodePreset({
  workspace: '/path/to/workspace',
  extensions: ['ms-python.python'],
  settings: {
    'editor.fontSize': 14
  },
  logs: {
    extension: true,
    console: true
  }
});

// Use in plugin config
testdriver({
  preset: chrome,
  // or
  preset: vscode
})
```

### 3.2 Preset Definition API

```typescript
interface ApplicationPreset {
  name: string;
  
  // Lifecycle hooks
  beforeConnect?: (client: TestDriver) => Promise<void>;
  afterConnect?: (client: TestDriver) => Promise<void>;
  beforeTest?: (client: TestDriver) => Promise<void>;
  afterTest?: (client: TestDriver) => Promise<void>;
  
  // Dashcam configuration
  dashcam?: {
    logs?: LogConfig[];
    scope?: 'test' | 'file' | 'suite';
  };
  
  // Launch configuration
  launch?: {
    command?: string;
    waitFor?: string;
    timeout?: number;
  };
}

// Example: Custom Slack preset
export const slackPreset = (options: {
  workspace: string;
  autoLogin?: boolean;
}): ApplicationPreset => ({
  name: 'Slack',
  
  async afterConnect(client) {
    // Launch Slack desktop app
    await client.exec('sh', 'open -a Slack');
    await client.wait(3000);
  },
  
  async beforeTest(client) {
    if (options.autoLogin) {
      await client.focusApplication('Slack');
      const workspace = await client.find('Workspace selector');
      await workspace.click();
      const ws = await client.find(options.workspace);
      await ws.click();
    }
  },
  
  dashcam: {
    logs: [
      {
        type: 'application',
        application: 'Slack',
        name: 'Slack Logs'
      }
    ],
    scope: 'test'
  }
});
```

### 3.3 Helper Functions

```typescript
// testdriverai/helpers

// Authentication helpers
export async function loginWithGoogle(
  client: TestDriver,
  email: string,
  password: string
): Promise<void>;

export async function loginWithGithub(
  client: TestDriver,
  username: string,
  password: string
): Promise<void>;

// Common workflows
export async function uploadFile(
  client: TestDriver,
  filePath: string,
  inputDescription: string
): Promise<void>;

export async function fillForm(
  client: TestDriver,
  formData: Record<string, string>
): Promise<void>;

// Waiting utilities
export async function waitForNavigation(
  client: TestDriver,
  expectedUrl: string,
  timeout?: number
): Promise<void>;

export async function waitForElement(
  client: TestDriver,
  description: string,
  timeout?: number
): Promise<Element>;

// Retry utilities
export async function retryUntilSuccess<T>(
  fn: () => Promise<T>,
  options?: { maxAttempts?: number; delay?: number }
): Promise<T>;
```

---

## Configuration System

### 4.1 Configuration Hierarchy

Configuration is resolved in this order (later overrides earlier):

1. Built-in defaults
2. `testdriver.config.ts` file
3. `vitest.config.ts` plugin options
4. Environment variables
5. Runtime options (passed to functions)

### 4.2 Shared Configuration File

```typescript
// testdriver.config.ts
import { defineConfig } from 'testdriverai';
import { chromePreset } from 'testdriverai/presets';

export default defineConfig({
  // Global defaults
  apiKey: process.env.TD_API_KEY,
  os: 'linux',
  
  // Dashcam defaults
  dashcam: {
    enabled: true,
    scope: 'test',
    apiKey: process.env.DASHCAM_API_KEY || process.env.TD_API_KEY
  },
  
  // Application preset
  preset: chromePreset({
    url: process.env.APP_URL || 'http://localhost:3000'
  }),
  
  // Per-environment overrides
  environments: {
    ci: {
      os: 'linux',
      dashcam: { enabled: true },
      recording: { includeScreenshots: true }
    },
    local: {
      os: 'mac',
      dashcam: { enabled: false },
      analytics: false
    }
  }
});
```

### 4.3 Environment-Specific Config

```typescript
// Automatically select based on NODE_ENV
export default defineConfig({
  extends: './testdriver.config.base.ts',
  
  // Only applied when NODE_ENV=production
  production: {
    os: 'linux',
    dashcam: { enabled: true }
  },
  
  // Only applied when NODE_ENV=development
  development: {
    os: 'mac',
    dashcam: { enabled: false },
    cache: false  // Disable cache in dev for accuracy
  }
});
```

---

## Usage Examples

### 5.1 Quick Start (90% Use Case)

**Goal**: Test a web app with minimal setup

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import testdriver from 'testdriverai/vitest';

export default defineConfig({
  plugins: [
    testdriver({
      preset: 'chrome',  // That's it!
      launch: { url: 'https://myapp.com' }
    })
  ]
});

// tests/smoke.test.ts
import { describe, it, expect } from 'vitest';
import { useTestDriver } from 'testdriverai/vitest';

describe('Smoke Tests', () => {
  const td = useTestDriver();
  
  it('homepage loads', async () => {
    expect(await td.assert('Homepage is visible')).toBe(true);
  });
  
  it('can login', async () => {
    const email = await td.find('Email field');
    await email.click();
    await td.type('test@example.com');
    
    const password = await td.find('Password field');
    await password.click();
    await td.type('password123');
    
    const submit = await td.find('Submit button');
    await submit.click();
    
    expect(await td.assert('Dashboard is visible')).toBe(true);
  });
});
```

### 5.2 Hybrid Mode: Custom Application Setup

**Goal**: Test VSCode extension with custom setup - plugin handles infrastructure, we customize launch

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import testdriver from 'testdriverai/vitest';

export default defineConfig({
  plugins: [
    testdriver({
      mode: 'hybrid',  // Plugin handles sandbox + recording, we handle launch
      os: 'linux',
      
      dashcam: {
        scope: 'file',  // One recording per file
        logs: [
          { type: 'file', path: '/tmp/vscode.log', name: 'VSCode Log' },
          { type: 'file', path: '/tmp/extension.log', name: 'Extension Log' }
        ]
      }
    })
  ]
});

// tests/extension.test.ts
import { describe, beforeAll, it } from 'vitest';
import { useTestDriver } from 'testdriverai/vitest';

describe('VSCode Extension', () => {
  const td = useTestDriver({ autoLaunch: false });  // Disable auto-launch
  
  beforeAll(async () => {
    // Custom: Install extension
    await td.exec('sh', 'code --install-extension ./my-extension.vsix', 30000);
    
    // Custom: Launch VSCode with workspace
    await td.exec('sh', 'code /workspace');
    await td.wait(5000);
  });
  
  it('extension activates', async () => {
    await td.focusApplication('Code');
    
    // Open command palette
    await td.pressKeys(['ctrl', 'shift', 'p']);
    
    // Search for extension command
    await td.type('My Extension: Run');
    await td.pressKeys(['enter']);
    
    expect(await td.assert('Extension output is visible')).toBe(true);
  });
  
  // Plugin auto-handles: sandbox cleanup, dashcam stop, test recording
});
```

### 5.3 Standalone SDK (No Plugin)

**Goal**: Use SDK in non-Vitest context (scripts, other frameworks)

```typescript
// scripts/test-production.ts
import { TestDriver, Dashcam } from 'testdriverai';

async function testProduction() {
  const td = new TestDriver(process.env.TD_API_KEY, {
    os: 'linux',
    resolution: '1920x1080'
  });
  
  await td.auth();
  await td.connect();
  
  const dashcam = new Dashcam(td);
  await dashcam.auth();
  await dashcam.start();
  
  try {
    // Launch browser
    await td.exec('sh', 'google-chrome --start-maximized https://myapp.com');
    await td.wait(3000);
    
    // Run test
    const loginBtn = await td.find('Login button');
    await loginBtn.click();
    
    const result = await td.assert('Login form is visible');
    console.log('Test passed:', result);
    
  } finally {
    const replayUrl = await dashcam.stop();
    console.log('Replay:', replayUrl);
    await td.disconnect();
  }
}

testProduction();
```

### 5.4 Multiple Applications in One Test

**Goal**: Test integration between Chrome and VSCode

```typescript
describe('Integration Test', () => {
  const td = useTestDriver({ autoLaunch: false });
  
  it('copy code from browser to vscode', async () => {
    // Launch Chrome
    await td.exec('sh', 'google-chrome https://github.com');
    await td.focusApplication('Google Chrome');
    
    // Find code snippet
    const code = await td.find('Code block');
    await code.click();
    await td.pressKeys(['ctrl', 'c']);  // Copy
    
    // Switch to VSCode
    await td.exec('sh', 'code');
    await td.focusApplication('Code');
    
    // Paste code
    await td.pressKeys(['ctrl', 'v']);
    
    expect(await td.assert('Code is pasted in editor')).toBe(true);
  });
});
```

### 5.5 Custom Preset Example

**Goal**: Create reusable preset for internal tool

```typescript
// presets/salesforce.ts
import { ApplicationPreset } from 'testdriverai';

export const salesforcePreset = (options: {
  instanceUrl: string;
  username?: string;
  password?: string;
}): ApplicationPreset => ({
  name: 'Salesforce',
  
  async afterConnect(client) {
    // Launch Chrome with Salesforce URL
    const url = `${options.instanceUrl}/lightning`;
    await client.exec('sh', `google-chrome --start-maximized "${url}"`);
    await client.wait(3000);
  },
  
  async beforeTest(client) {
    // Auto-login if credentials provided
    if (options.username && options.password) {
      await client.focusApplication('Google Chrome');
      
      const usernameField = await client.find('Username field');
      await usernameField.click();
      await client.type(options.username);
      
      const passwordField = await client.find('Password field');
      await passwordField.click();
      await client.type(options.password);
      
      const loginBtn = await client.find('Log In button');
      await loginBtn.click();
      
      await client.wait(5000);  // Wait for dashboard
    }
  },
  
  dashcam: {
    scope: 'test',
    logs: [
      {
        type: 'file',
        path: '/tmp/salesforce-console.log',
        name: 'Browser Console'
      }
    ]
  }
});

// Use it
import { salesforcePreset } from './presets/salesforce';

testdriver({
  preset: salesforcePreset({
    instanceUrl: 'https://mycompany.salesforce.com',
    username: process.env.SF_USERNAME,
    password: process.env.SF_PASSWORD
  })
})
```

---

## Migration Path

### 6.1 Current State → Optimal State

**Phase 1: Immediate Improvements (Week 1-2)**
- ✅ Extract dashcam logic into separate `Dashcam` class
- ✅ Create `useTestDriver()` hook for cleaner test code
- ✅ Add preset system with `chromePreset` as first preset
- ✅ Document lifecycle modes (auto/manual/hybrid)

**Phase 2: Plugin Enhancement (Week 3-4)**
- ✅ Implement auto-lifecycle mode in plugin
- ✅ Add configuration file support (`testdriver.config.ts`)
- ✅ Create helper function library
- ✅ Add hooks system (onBeforeConnect, etc.)

**Phase 3: Preset Ecosystem (Week 5-6)**
- ✅ Build VSCode preset
- ✅ Build Figma/design tool presets
- ✅ Create preset builder API
- ✅ Documentation for custom presets

**Phase 4: DX Polish (Week 7-8)**
- ✅ Full TypeScript definitions
- ✅ Better error messages with context
- ✅ CLI tool for generating presets
- ✅ Example repository with common patterns

### 6.2 Backward Compatibility

All current code continues to work:

```typescript
// OLD WAY (still works)
import { createTestClient, setupTest, teardownTest } from './testHelpers';

beforeEach(async (ctx) => {
  testdriver = createTestClient({ task: ctx.task });
  await setupTest(testdriver);
});

// NEW WAY (recommended)
import { useTestDriver } from 'testdriverai/vitest';

const td = useTestDriver();  // Auto-configured
```

### 6.3 Deprecation Timeline

- **Now - 3 months**: Both old and new APIs supported
- **3-6 months**: Old API marked as deprecated (warnings)
- **6+ months**: Old API removed (major version bump)

---

## Benefits Summary

### For 90% of Users (Quick Start)
```typescript
// One line in config
testdriver({ preset: 'chrome', launch: { url: 'https://myapp.com' } })

// Clean test code
const td = useTestDriver();
await td.find('Button').click();
```

**Benefits:**
- ✅ Get started in <5 minutes
- ✅ No boilerplate code
- ✅ Automatic dashcam recording
- ✅ Built-in test reporting
- ✅ Smart defaults for everything

### For 10% of Users (Advanced)
```typescript
// Full control when needed
const td = createTestDriver();
const dashcam = createDashcam(td, { logs: [...] });
await customSetup();
```

**Benefits:**
- ✅ Granular control over lifecycle
- ✅ Custom application support
- ✅ Complex multi-app scenarios
- ✅ Reusable presets for internal tools
- ✅ Integration with any framework

### For SDK Maintainers
- ✅ Clear separation of concerns (SDK vs Plugin vs Presets)
- ✅ Easy to test each layer independently
- ✅ Simple to add new presets without touching core
- ✅ Better documentation structure
- ✅ Easier onboarding for contributors

---

## Appendix

### A. File Structure

```
testdriverai/
├── src/
│   ├── core/
│   │   ├── TestDriver.ts        # Core SDK class
│   │   ├── Element.ts           # Element class
│   │   ├── Dashcam.ts           # Dashcam module
│   │   └── types.ts             # Core types
│   ├── vitest/
│   │   ├── plugin.ts            # Vitest plugin
│   │   ├── hooks.ts             # useTestDriver, etc.
│   │   ├── lifecycle.ts         # Auto lifecycle
│   │   └── reporter.ts          # Test recording
│   ├── presets/
│   │   ├── index.ts             # Preset registry
│   │   ├── chrome.ts            # Chrome preset
│   │   ├── vscode.ts            # VSCode preset
│   │   ├── types.ts             # Preset types
│   │   └── builder.ts           # Preset builder
│   ├── helpers/
│   │   ├── auth.ts              # Auth helpers
│   │   ├── forms.ts             # Form helpers
│   │   ├── wait.ts              # Wait utilities
│   │   └── retry.ts             # Retry logic
│   └── config/
│       ├── loader.ts            # Config file loader
│       ├── schema.ts            # Config validation
│       └── defaults.ts          # Default values
├── examples/
│   ├── quickstart/
│   ├── advanced/
│   ├── custom-preset/
│   └── multi-app/
└── docs/
    ├── getting-started.md
    ├── vitest-plugin.md
    ├── presets.md
    └── api-reference.md
```

### B. Package Exports

```json
{
  "name": "testdriverai",
  "exports": {
    ".": "./dist/index.js",
    "./vitest": "./dist/vitest/index.js",
    "./presets": "./dist/presets/index.js",
    "./helpers": "./dist/helpers/index.js",
    "./config": "./dist/config/index.js"
  }
}
```

### C. TypeScript Definitions

```typescript
// Main exports
export { TestDriver, Dashcam, Element } from './core';
export type { TestDriverOptions, DashcamOptions, LogConfig } from './core/types';

// Vitest exports
export { useTestDriver, useDashcam, onBeforeConnect } from './vitest';
export type { VitestPluginOptions } from './vitest/types';

// Preset exports
export { chromePreset, vscodePreset, definePreset } from './presets';
export type { ApplicationPreset, PresetOptions } from './presets/types';

// Helper exports
export * from './helpers';

// Config exports
export { defineConfig } from './config';
export type { TestDriverConfig } from './config/types';
```

---

## Conclusion

This design provides:

1. **Simple for beginners**: One-line setup for common cases
2. **Powerful for experts**: Full control when needed
3. **Maintainable**: Clear separation of concerns
4. **Extensible**: Easy to add new presets and helpers
5. **Type-safe**: Full TypeScript support
6. **Well-documented**: Clear examples for every use case

The key insight is **progressive disclosure** - users start simple and only learn about advanced features when they need them. The preset system and helper functions cover the most common use cases, while the manual mode and hook system provide escape hatches for edge cases.
