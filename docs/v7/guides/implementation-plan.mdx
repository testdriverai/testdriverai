# TestDriver SDK Redesign - Implementation Plan

## Overview

This document breaks down the implementation of the optimal SDK design into actionable tasks. Work is organized into 4 phases over ~8 weeks, with each phase building on the previous one while maintaining backward compatibility.

---

## Phase 1: Core Foundation (Week 1-2)

### Goal
Extract core components into clean, composable modules without breaking existing functionality.

### Tasks

#### 1.1 Create Dashcam Class (Priority: HIGH)
**File**: `src/core/Dashcam.js` (new)

**What to build:**
```javascript
class Dashcam {
  constructor(client, options = {}) {
    this.client = client;
    this.apiKey = options.apiKey;
    this.autoStart = options.autoStart ?? false;
    this.logs = options.logs || [];
    this.recording = false;
  }
  
  async auth(apiKey) { /* ... */ }
  async addLog(config) { /* ... */ }
  async addFileLog(path, name) { /* ... */ }
  async addApplicationLog(app, name) { /* ... */ }
  async start() { /* ... */ }
  async stop() { /* returns replay URL */ }
  async isRecording() { /* ... */ }
}
```

**Migration steps:**
1. Extract logic from `lifecycleHelpers.mjs`:
   - `authDashcam()` → `Dashcam.auth()`
   - `addDashcamLog()` → `Dashcam.addLog()`
   - `startDashcam()` → `Dashcam.start()`
   - `stopDashcam()` → `Dashcam.stop()`

2. Keep old helpers as thin wrappers:
```javascript
// lifecycleHelpers.mjs
export async function authDashcam(client, apiKey) {
  const dashcam = new Dashcam(client);
  return dashcam.auth(apiKey);
}
```

3. Update tests to use new class (optional, gradual)

**Validation:**
- [ ] All existing tests pass with old helpers
- [ ] New Dashcam class works standalone
- [ ] Windows and Linux support maintained

---

#### 1.2 Create Helper Functions Module (Priority: LOW)
**File**: `src/helpers/index.js` (new)

**What to build:**
Start with most useful helpers:

```javascript
// src/helpers/wait.js
export async function waitForElement(client, description, timeout = 30000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const el = await client.find(description);
    if (el.found()) return el;
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Element not found: ${description}`);
}

// src/helpers/retry.js
export async function retryUntilSuccess(fn, options = {}) {
  const { maxAttempts = 3, delay = 1000 } = options;
  let lastError;
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

// src/helpers/forms.js
export async function fillForm(client, formData) {
  for (const [fieldName, value] of Object.entries(formData)) {
    const field = await client.find(fieldName);
    await field.click();
    await client.type(value);
  }
}
```

**Validation:**
- [ ] Helpers work with TestDriver instance
- [ ] Can be imported individually
- [ ] Documentation with examples

---

#### 1.3 Update Package Exports (Priority: HIGH)
**File**: `package.json`

**What to change:**
```json
{
  "exports": {
    ".": "./sdk.js",
    "./core": "./src/core/index.js",
    "./helpers": "./src/helpers/index.js",
    "./vitest": "./interfaces/vitest-plugin.mjs"
  }
}
```

**Create**: `src/core/index.js`
```javascript
export { default as TestDriver } from '../../sdk.js';
export { Dashcam } from './Dashcam.js';
```

**Validation:**
- [ ] `import TestDriver from 'testdriverai'` works
- [ ] `import { Dashcam } from 'testdriverai/core'` works
- [ ] `import { waitForElement } from 'testdriverai/helpers'` works

---

## Phase 2: Vitest Plugin Enhancement (Week 3-4)

### Goal
Implement auto-lifecycle mode and useTestDriver hook for cleaner test code.

### Tasks

#### 2.1 Create useTestDriver Hook (Priority: HIGH)
**File**: `interfaces/vitest/hooks.mjs` (new)

**What to build:**
```javascript
import { beforeAll, afterAll } from 'vitest';
import TestDriver from '../../sdk.js';

let clientInstance = null;

export function useTestDriver(options = {}) {
  // Return existing instance if already created
  if (clientInstance) return clientInstance;
  
  const {
    autoConnect = true,
    autoLaunch = true,
    ...clientOptions
  } = options;
  
  if (autoConnect) {
    beforeAll(async () => {
      clientInstance = new TestDriver(
        process.env.TD_API_KEY,
        {
          os: process.env.TEST_PLATFORM || 'linux',
          ...clientOptions
        }
      );
      
      await clientInstance.auth();
      await clientInstance.connect();
      
      // Auto-launch if configured and preset available
      if (autoLaunch && globalThis.__testdriverPreset) {
        await globalThis.__testdriverPreset.afterConnect(clientInstance);
      }
    });
    
    afterAll(async () => {
      if (clientInstance) {
        await clientInstance.disconnect();
        clientInstance = null;
      }
    });
  }
  
  return new Proxy({}, {
    get(target, prop) {
      // Return client methods lazily
      if (!clientInstance) {
        throw new Error('TestDriver not connected. Did beforeAll run?');
      }
      return clientInstance[prop];
    }
  });
}
```

**Validation:**
- [ ] Works in test files with minimal setup
- [ ] Handles parallel tests correctly
- [ ] Error messages are helpful
- [ ] Cleanup happens properly

---

#### 2.2 Create useDashcam Hook (Priority: HIGH)
**File**: `interfaces/vitest/hooks.mjs` (modify)

**What to build:**
```javascript
import { beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { Dashcam } from '../../src/core/Dashcam.js';

let dashcamInstance = null;

export function useDashcam(options = {}) {
  const {
    scope = 'test',  // 'test' | 'file' | 'suite'
    logs = [],
    autoStart = true,
    ...dashcamOptions
  } = options;
  
  const client = useTestDriver();
  
  // Setup based on scope
  if (scope === 'test') {
    beforeEach(async () => {
      if (!dashcamInstance) {
        dashcamInstance = new Dashcam(client, { logs, ...dashcamOptions });
        await dashcamInstance.auth();
        for (const log of logs) {
          await dashcamInstance.addLog(log);
        }
      }
      if (autoStart) {
        await dashcamInstance.start();
      }
    });
    
    afterEach(async (context) => {
      const url = await dashcamInstance.stop();
      if (context.task) {
        context.task.meta.testdriverDashcamUrl = url;
      }
    });
  } else if (scope === 'file') {
    beforeAll(async () => {
      dashcamInstance = new Dashcam(client, { logs, ...dashcamOptions });
      await dashcamInstance.auth();
      for (const log of logs) {
        await dashcamInstance.addLog(log);
      }
      if (autoStart) {
        await dashcamInstance.start();
      }
    });
    
    afterAll(async () => {
      const url = await dashcamInstance.stop();
      console.log('📹 Recording:', url);
      dashcamInstance = null;
    });
  }
  
  return dashcamInstance;
}
```

**Validation:**
- [ ] Per-test recording works
- [ ] Per-file recording works
- [ ] URLs captured correctly
- [ ] Cleanup happens at right time

---

#### 2.3 Simplify Plugin Configuration (Priority: MEDIUM)
**File**: `interfaces/vitest-plugin.mjs` (modify)

**What to change:**
Make plugin accept simplified config:

```javascript
export default function testDriverPlugin(options = {}) {
  const {
    mode = 'auto',  // NEW: auto | manual | hybrid
    preset = null,  // NEW: preset configuration
    launch = null,  // NEW: simple launch config
    dashcam = {},
    ...restOptions
  } = options;
  
  // Store preset globally for useTestDriver
  if (preset) {
    globalThis.__testdriverPreset = typeof preset === 'string' 
      ? getBuiltinPreset(preset, launch)
      : preset;
  }
  
  // Store dashcam config globally
  globalThis.__testdriverDashcamConfig = dashcam;
  
  // Rest of existing plugin logic...
}
```

**Validation:**
- [ ] Backward compatible with existing config
- [ ] New options work as expected
- [ ] Error messages for invalid config

---

#### 2.4 Update Test Helpers to Use Hooks (Priority: LOW)
**File**: Create new example files showing migration

**What to create:**
```javascript
// examples/vitest-migration.md
# Migration to useTestDriver Hook

## Old Way
```javascript
import { createTestClient, setupTest, teardownTest } from './testHelpers';

beforeEach(async (ctx) => {
  testdriver = createTestClient({ task: ctx.task });
  await setupTest(testdriver);
});

afterEach(async (ctx) => {
  await teardownTest(testdriver, { task: ctx.task });
});
```

## New Way
```javascript
import { useTestDriver } from 'testdriverai/vitest';

const td = useTestDriver();  // That's it!
```

**Validation:**
- [ ] Migration guide written
- [ ] Example tests converted
- [ ] Both old and new ways work

---

## Phase 3: Presets System (Week 5-6)

### Goal
Build preset system with at least 2 working presets (Chrome, VSCode).

### Tasks

#### 3.1 Define Preset Interface (Priority: HIGH)
**File**: `src/presets/types.js` (new)

**What to build:**
```javascript
/**
 * @typedef {Object} ApplicationPreset
 * @property {string} name - Preset name
 * @property {Function} [beforeConnect] - Called before sandbox connects
 * @property {Function} [afterConnect] - Called after sandbox connects
 * @property {Function} [beforeTest] - Called before each test
 * @property {Function} [afterTest] - Called after each test
 * @property {Object} [dashcam] - Dashcam configuration
 * @property {Object} [launch] - Launch configuration
 */

export class PresetBuilder {
  constructor(name) {
    this.preset = { name };
  }
  
  beforeConnect(fn) {
    this.preset.beforeConnect = fn;
    return this;
  }
  
  afterConnect(fn) {
    this.preset.afterConnect = fn;
    return this;
  }
  
  withDashcam(config) {
    this.preset.dashcam = config;
    return this;
  }
  
  build() {
    return this.preset;
  }
}

export function definePreset(config) {
  return config;
}
```

**Validation:**
- [ ] TypeScript types generated
- [ ] JSDoc comments complete
- [ ] Interface makes sense for various apps

---

#### 3.2 Build Chrome Preset (Priority: HIGH)
**File**: `src/presets/chrome.js` (new)

**What to build:**
```javascript
import { definePreset } from './types.js';

export function chromePreset(options = {}) {
  const {
    url = 'http://localhost:3000',
    waitFor = null,
    profile = 'guest',
    windowSize = 'maximized',
    logs = false
  } = options;
  
  return definePreset({
    name: 'Chrome',
    
    async afterConnect(client) {
      const shell = client.os === 'windows' ? 'pwsh' : 'sh';
      
      let chromeCmd;
      if (client.os === 'windows') {
        chromeCmd = `Start-Process "C:/Program Files/Google/Chrome/Application/chrome.exe" -ArgumentList "--start-maximized", "--${profile}", "${url}"`;
      } else {
        chromeCmd = `google-chrome --start-maximized --${profile} "${url}" >/dev/null 2>&1 &`;
      }
      
      await client.exec(shell, chromeCmd, 30000);
      await client.wait(3000);
      
      if (waitFor) {
        const startTime = Date.now();
        while (Date.now() - startTime < 60000) {
          const el = await client.find(waitFor);
          if (el.found()) break;
          await client.wait(2000);
        }
      }
    },
    
    dashcam: logs ? {
      scope: 'test',
      logs: [
        // TODO: How to capture browser console logs?
        // This might need browser extension or special setup
      ]
    } : undefined
  });
}
```

**Validation:**
- [ ] Works on Linux
- [ ] Works on Windows
- [ ] Handles various Chrome options
- [ ] waitFor works correctly

---

#### 3.3 Build VSCode Preset (Priority: MEDIUM)
**File**: `src/presets/vscode.js` (new)

**What to build:**
```javascript
import { definePreset } from './types.js';

export function vscodePreset(options = {}) {
  const {
    workspace = null,
    extensions = [],
    settings = {},
    logs = { extension: true, console: true }
  } = options;
  
  return definePreset({
    name: 'VSCode',
    
    async afterConnect(client) {
      // Install extensions
      for (const ext of extensions) {
        await client.exec('sh', `code --install-extension ${ext}`, 60000);
      }
      
      // Apply settings
      if (Object.keys(settings).length > 0) {
        const settingsJson = JSON.stringify(settings, null, 2);
        await client.exec('sh', `echo '${settingsJson}' > ~/.config/Code/User/settings.json`);
      }
      
      // Launch VSCode
      const launchCmd = workspace 
        ? `code ${workspace}`
        : 'code';
      await client.exec('sh', launchCmd, 30000);
      await client.wait(5000);
    },
    
    dashcam: {
      scope: 'test',
      logs: [
        logs.extension ? {
          type: 'file',
          path: '~/.config/Code/logs/extension.log',
          name: 'Extension Log'
        } : null,
        logs.console ? {
          type: 'file',
          path: '~/.config/Code/logs/console.log',
          name: 'Console Log'
        } : null
      ].filter(Boolean)
    }
  });
}
```

**Validation:**
- [ ] Installs extensions correctly
- [ ] Applies settings
- [ ] Launches workspace
- [ ] Logs captured properly

---

#### 3.4 Create Preset Registry (Priority: LOW)
**File**: `src/presets/index.js` (new)

**What to build:**
```javascript
import { chromePreset } from './chrome.js';
import { vscodePreset } from './vscode.js';

const BUILTIN_PRESETS = {
  chrome: chromePreset,
  vscode: vscodePreset
};

export function getBuiltinPreset(name, options = {}) {
  const presetFn = BUILTIN_PRESETS[name];
  if (!presetFn) {
    throw new Error(`Unknown preset: ${name}. Available: ${Object.keys(BUILTIN_PRESETS).join(', ')}`);
  }
  return presetFn(options);
}

export { chromePreset, vscodePreset };
export { definePreset, PresetBuilder } from './types.js';
```

**Validation:**
- [ ] Presets can be imported individually
- [ ] Registry lookup works
- [ ] Good error messages

---

## Phase 4: DX Polish & Documentation (Week 7-8)

### Goal
Polish developer experience, add TypeScript definitions, write comprehensive docs.

### Tasks

#### 4.1 TypeScript Definitions (Priority: HIGH)
**File**: `types/index.d.ts` (new)

**What to build:**
```typescript
// Core SDK
export class TestDriver {
  constructor(apiKey?: string, options?: TestDriverOptions);
  auth(): Promise<void>;
  connect(options?: ConnectOptions): Promise<SandboxInstance>;
  disconnect(): Promise<void>;
  find(description: string): Promise<Element>;
  findAll(description: string): Promise<Element[]>;
  // ... all other methods
}

export interface TestDriverOptions {
  apiKey?: string;
  apiRoot?: string;
  os?: 'linux' | 'windows' | 'mac';
  resolution?: string;
  cache?: boolean;
  analytics?: boolean;
  sandbox?: SandboxOptions;
}

// Dashcam
export class Dashcam {
  constructor(client: TestDriver, options?: DashcamOptions);
  auth(apiKey?: string): Promise<void>;
  addLog(config: LogConfig): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<string | null>;
  isRecording(): Promise<boolean>;
}

export interface DashcamOptions {
  apiKey?: string;
  autoStart?: boolean;
  logs?: LogConfig[];
}

export interface LogConfig {
  name: string;
  type: 'file' | 'stdout' | 'application';
  path?: string;
  application?: string;
}

// Vitest Plugin
export interface VitestPluginOptions {
  apiKey?: string;
  apiRoot?: string;
  mode?: 'auto' | 'manual' | 'hybrid';
  preset?: string | ApplicationPreset;
  launch?: LaunchConfig;
  dashcam?: DashcamConfig;
  os?: 'linux' | 'windows' | 'mac';
}

export function useTestDriver(options?: UseTestDriverOptions): TestDriver;
export function useDashcam(options?: UseDashcamOptions): Dashcam;

// Presets
export interface ApplicationPreset {
  name: string;
  beforeConnect?: (client: TestDriver) => Promise<void>;
  afterConnect?: (client: TestDriver) => Promise<void>;
  beforeTest?: (client: TestDriver) => Promise<void>;
  afterTest?: (client: TestDriver) => Promise<void>;
  dashcam?: DashcamConfig;
  launch?: LaunchConfig;
}

export function chromePreset(options?: ChromePresetOptions): ApplicationPreset;
export function vscodePreset(options?: VSCodePresetOptions): ApplicationPreset;
export function definePreset(config: ApplicationPreset): ApplicationPreset;

// Helpers
export function waitForElement(
  client: TestDriver,
  description: string,
  timeout?: number
): Promise<Element>;

export function retryUntilSuccess<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T>;

export function fillForm(
  client: TestDriver,
  formData: Record<string, string>
): Promise<void>;
```

**Validation:**
- [ ] All exports have types
- [ ] JSDoc and TypeScript match
- [ ] IntelliSense works in VSCode
- [ ] No `any` types unless necessary

---

#### 4.2 Create Examples Repository (Priority: MEDIUM)
**Directory**: `examples/` (new structure)

**What to create:**
```
examples/
├── quickstart/
│   ├── basic-web-test.test.js
│   ├── with-dashcam.test.js
│   └── README.md
├── advanced/
│   ├── custom-app.test.js
│   ├── multi-app-integration.test.js
│   ├── manual-lifecycle.test.js
│   └── README.md
├── custom-preset/
│   ├── salesforce-preset.js
│   ├── slack-preset.js
│   ├── using-custom-preset.test.js
│   └── README.md
└── migration/
    ├── before-helpers.test.js
    ├── after-hooks.test.js
    └── README.md
```

**Each example should:**
- [ ] Work out of the box
- [ ] Have clear comments
- [ ] Show common patterns
- [ ] Include README with context

---

#### 4.3 Write Comprehensive Documentation (Priority: HIGH)
**Files**: Multiple new docs

**What to create:**

1. **Getting Started Guide** (`docs/getting-started.md`)
   - Installation
   - First test in 5 minutes
   - Quick wins with auto mode

2. **Vitest Plugin Guide** (`docs/vitest-plugin.md`)
   - Configuration options
   - Lifecycle modes explained
   - useTestDriver and useDashcam hooks
   - Best practices

3. **Presets Guide** (`docs/presets.md`)
   - Using built-in presets
   - Creating custom presets
   - Preset API reference
   - Common patterns

4. **API Reference** (`docs/api-reference.md`)
   - TestDriver class
   - Dashcam class
   - Element class
   - Helper functions
   - All methods documented

5. **Migration Guide** (`docs/migration-guide.md`)
   - From testHelpers to hooks
   - Timeline and deprecation plan
   - Side-by-side examples
   - Troubleshooting

**Validation:**
- [ ] All docs reviewed for clarity
- [ ] Code examples tested
- [ ] Links work
- [ ] Table of contents generated

---

#### 4.4 Improve Error Messages (Priority: MEDIUM)
**Files**: Various SDK files

**What to improve:**

1. **Better context in errors:**
```javascript
// Before
throw new Error('Not connected');

// After
throw new Error(
  'TestDriver client not connected. ' +
  'Did you call await client.auth() and await client.connect()? ' +
  'Or if using useTestDriver(), did the beforeAll hook run?'
);
```

2. **Validation errors:**
```javascript
// In plugin config
if (options.mode && !['auto', 'manual', 'hybrid'].includes(options.mode)) {
  throw new Error(
    `Invalid mode: "${options.mode}". ` +
    `Expected one of: auto, manual, hybrid`
  );
}
```

3. **Helpful preset errors:**
```javascript
if (!preset && options.launch) {
  console.warn(
    'Warning: launch configuration provided but no preset specified. ' +
    'Launch config will be ignored. Did you mean to add preset: "chrome"?'
  );
}
```

**Validation:**
- [ ] Common mistakes have helpful errors
- [ ] Error messages tested manually
- [ ] Include suggestions for fixes

---

#### 4.5 Create CLI for Preset Generation (Priority: LOW)
**File**: `bin/create-preset.js` (new)

**What to build:**
```javascript
#!/usr/bin/env node

// Interactive CLI to scaffold a new preset

import inquirer from 'inquirer';
import fs from 'fs';

const answers = await inquirer.prompt([
  {
    type: 'input',
    name: 'name',
    message: 'Preset name (e.g., "slack", "figma"):',
  },
  {
    type: 'input',
    name: 'application',
    message: 'Application to launch:',
  },
  {
    type: 'confirm',
    name: 'needsLogs',
    message: 'Does this app need log tracking?',
  },
  // ... more questions
]);

// Generate preset file from template
const presetCode = generatePresetTemplate(answers);
fs.writeFileSync(`./presets/${answers.name}.js`, presetCode);

console.log(`✅ Preset created at ./presets/${answers.name}.js`);
```

**Validation:**
- [ ] Generates working preset
- [ ] Includes helpful comments
- [ ] Interactive and user-friendly

---

## Testing Strategy

### For Each Phase

1. **Unit Tests**
   - Test each class/function in isolation
   - Mock TestDriver instance where needed
   - Cover edge cases

2. **Integration Tests**
   - Test components working together
   - Use actual TestDriver sandbox (on CI)
   - Cover common workflows

3. **Backward Compatibility**
   - Keep all existing tests passing
   - Old helpers still work
   - Gradual migration possible

### Test Coverage Goals

- Core SDK classes: 80%+
- Helpers: 90%+ (they're simple)
- Presets: Manual testing + smoke tests
- Plugin hooks: Integration tests

---

## Migration & Rollout Strategy

### Phase 1-2: Soft Launch
- New features available but not documented prominently
- Internal testing on acceptance-sdk tests
- Gather feedback

### Phase 3: Beta Release
- Announce new APIs in Discord
- Update main docs to show new way
- Mark old helpers as "legacy" in docs
- Both ways fully supported

### Phase 4: v8.0 Release
- New APIs are default in docs
- Old APIs show deprecation warnings
- Migration guide complete
- Example repository published

### Post-Launch (3-6 months)
- Collect feedback and iterate
- Build more presets based on demand
- Add more helpers based on patterns
- Consider removing old APIs in v9.0

---

## Success Metrics

### Developer Experience
- [ ] Time to first test: < 5 minutes (down from ~15)
- [ ] Lines of boilerplate code: < 5 (down from ~50)
- [ ] Support questions about setup: -50%

### Code Quality
- [ ] Test coverage maintained at 70%+
- [ ] All phases completed on schedule
- [ ] No regressions in existing functionality

### Adoption
- [ ] 50% of new tests use new APIs within 3 months
- [ ] 3+ community presets created
- [ ] Positive feedback from early adopters

---

## Risk Mitigation

### Risk: Breaking Changes
- **Mitigation**: Maintain old APIs, extensive testing, gradual rollout

### Risk: Over-Abstraction
- **Mitigation**: Always expose core SDK, thin wrappers only, escape hatches

### Risk: Preset Complexity
- **Mitigation**: Start with 2 simple presets, iterate based on feedback

### Risk: Timeline Slip
- **Mitigation**: Phase 1-2 are MVP, Phase 3-4 can extend if needed

---

## Open Questions

1. **Dashcam browser console logs**: How do we capture Chrome console logs for the Chrome preset?
   - Option A: Browser extension
   - Option B: DevTools protocol
   - Option C: File-based logging only

2. **Preset discovery**: Should we have a preset registry/marketplace?
   - Option A: Just document how to create and share
   - Option B: NPM packages (e.g., `@testdriver/preset-salesforce`)
   - Option C: Built-in registry with community submissions

3. **TypeScript migration**: Should we migrate entire codebase to TypeScript?
   - Option A: Just type definitions (.d.ts)
   - Option B: Gradual migration, new code in TS
   - Option C: Full rewrite in TS (v9.0)

4. **Other test frameworks**: Should we support Jest, Mocha, etc.?
   - Option A: Vitest only (current plan)
   - Option B: Framework-agnostic helpers
   - Option C: Plugins for each framework

---

## Next Steps

1. **Immediate (This Week)**
   - [ ] Review this plan with team
   - [ ] Decide on open questions
   - [ ] Set up project board with tasks
   - [ ] Create Phase 1 branch

2. **Week 1**
   - [ ] Start Phase 1.1 (Dashcam class)
   - [ ] Draft TypeScript types alongside implementation
   - [ ] Write tests for Dashcam class

3. **Week 2**
   - [ ] Complete Phase 1
   - [ ] Start Phase 2.1 (useTestDriver hook)
   - [ ] Begin migration of one test file as proof of concept

**Let's build this! 🚀**
