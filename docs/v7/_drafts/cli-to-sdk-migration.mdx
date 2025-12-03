# Migration Guide: v6 → v7

This guide helps you migrate from the old TestDriver API (v6) to the new SDK architecture (v7).

## Overview

v7 introduces a **progressive disclosure** pattern with three API levels:

1. **Presets** (Beginner) - Zero config, instant setup
2. **Hooks** (Intermediate) - Flexible lifecycle management
3. **Core Classes** (Advanced) - Full manual control

You can mix and match these patterns based on your needs.

## Quick Migration Examples

### Before (v6) - Legacy Helpers

```javascript
import { test } from 'vitest';
import { authDashcam, startDashcam, stopDashcam } from 'testdriverai';

test('my test', async ({ client }) => {
  await authDashcam(client);
  await startDashcam(client);
  
  await client.find('Login button').click();
  
  const url = await stopDashcam(client);
  console.log('Replay:', url);
});
```

### After (v7) - Using Presets

```javascript
import { test } from 'vitest';
import { chromePreset } from 'testdriverai/presets';

test('my test', async (context) => {
  const { client } = await chromePreset(context, {
    url: 'https://myapp.com'
  });
  
  // Dashcam already running, auto-stops at test end
  await client.find('Login button').click();
});
```

### After (v7) - Using Hooks

```javascript
import { test } from 'vitest';
import { useTestDriver, useDashcam } from 'testdriverai/vitest/hooks';

test('my test', async (context) => {
  const client = useTestDriver(context, { os: 'linux' });
  const dashcam = useDashcam(context, client, {
    autoAuth: true,
    autoStart: true,
    autoStop: true
  });
  
  await client.find('Login button').click();
});
```

### After (v7) - Using Core Classes

```javascript
import { test } from 'vitest';
import { TestDriver, Dashcam } from 'testdriverai/core';

test('my test', async (context) => {
  const client = new TestDriver(process.env.TD_API_KEY, { os: 'linux' });
  const dashcam = new Dashcam(client);
  
  await client.auth();
  await client.connect();
  
  await dashcam.auth();
  await dashcam.start();
  
  await client.find('Login button').click();
  
  const url = await dashcam.stop();
  await client.disconnect();
  
  console.log('Replay:', url);
});
```

## Package Exports

v7 introduces multiple entry points for different use cases:

```javascript
// Main SDK (unchanged)
import TestDriver from 'testdriverai';

// Core classes
import { TestDriver, Dashcam } from 'testdriverai/core';

// Vitest hooks
import { useTestDriver, useDashcam } from 'testdriverai/vitest/hooks';

// Presets
import { chromePreset, vscodePreset } from 'testdriverai/presets';

// Vitest plugin (unchanged)
import testDriver from 'testdriverai/vitest';
```

## API Changes

### Dashcam Lifecycle Helpers (DEPRECATED)

The following functions are **deprecated** but still work for backward compatibility:

```javascript
// ❌ OLD (still works, but deprecated)
import { 
  authDashcam,
  addDashcamLog,
  startDashcam,
  stopDashcam 
} from 'testdriverai';

authDashcam(client);
startDashcam(client);
stopDashcam(client);
```

**Migrate to:**

```javascript
// ✅ NEW - Direct class usage
import { Dashcam } from 'testdriverai/core';

const dashcam = new Dashcam(client);
await dashcam.auth();
await dashcam.start();
const url = await dashcam.stop();
```

Or even better:

```javascript
// ✅ NEW - Using hooks
import { useDashcam } from 'testdriverai/vitest/hooks';

const dashcam = useDashcam(context, client, {
  autoAuth: true,
  autoStart: true,
  autoStop: true
});
```

### TestDriver Client Creation

**No changes needed** - the main SDK API remains the same:

```javascript
// Still works exactly the same
import TestDriver from 'testdriverai';
const client = new TestDriver(apiKey, { os: 'linux' });
```

But you now have cleaner alternatives:

```javascript
// Using hooks (auto-cleanup)
import { useTestDriver } from 'testdriverai/vitest/hooks';
const client = useTestDriver(context, { os: 'linux' });

// Using presets (zero config)
import { chromePreset } from 'testdriverai/presets';
const { browser } = await chromePreset(context, { url: 'https://example.com' });
```

## Migration Strategies

### Strategy 1: Gradual Migration

Keep existing tests working, adopt new APIs for new tests:

```javascript
// old-test.js - Leave as-is
import { authDashcam, startDashcam } from 'testdriverai';

// new-test.js - Use new APIs
import { chromePreset } from 'testdriverai/presets';
```

The old helpers will continue to work indefinitely.

### Strategy 2: Convert to Hooks

Replace lifecycle helpers with hooks for better lifecycle management:

**Before:**
```javascript
import { authDashcam, startDashcam, stopDashcam } from 'testdriverai';

test('my test', async ({ client }) => {
  await authDashcam(client);
  await startDashcam(client);
  // test code
  await stopDashcam(client);
});
```

**After:**
```javascript
import { useDashcam } from 'testdriverai/vitest/hooks';

test('my test', async (context) => {
  // Assuming client is already available via plugin or another hook
  const dashcam = useDashcam(context, client, {
    autoAuth: true,
    autoStart: true,
    autoStop: true
  });
  // test code
  // Auto-stops at test end
});
```

### Strategy 3: Adopt Presets

For common scenarios (Chrome, VS Code, Electron), use presets:

**Before:**
```javascript
test('chrome test', async ({ client }) => {
  await authDashcam(client);
  await startDashcam(client);
  
  await client.exec('sh', 'google-chrome "https://example.com" &', 30000);
  await client.focusApplication('Google Chrome');
  
  await client.find('button').click();
  
  await stopDashcam(client);
});
```

**After:**
```javascript
test('chrome test', async (context) => {
  const { browser } = await chromePreset(context, {
    url: 'https://example.com'
  });
  
  await browser.find('button').click();
  // Dashcam auto-stops, cleanup automatic
});
```

## Benefits of Migration

### Before Migration

- ❌ Manual lifecycle management (easy to forget cleanup)
- ❌ Lots of boilerplate for common scenarios
- ❌ No TypeScript support
- ❌ Helper functions scattered across codebase
- ❌ Tight coupling to plugin

### After Migration

- ✅ Automatic lifecycle management (hooks)
- ✅ Zero boilerplate (presets)
- ✅ Full TypeScript definitions
- ✅ Organized, composable APIs
- ✅ Works with or without plugin

## Common Patterns

### Pattern 1: Chrome Testing

```javascript
// OLD
test('chrome test', async ({ client }) => {
  await client.exec('sh', 'google-chrome "https://example.com" &', 30000);
  await client.focusApplication('Google Chrome');
  await authDashcam(client);
  await startDashcam(client);
  // ... test code
  await stopDashcam(client);
});

// NEW
import { chromePreset } from 'testdriverai/presets';

test('chrome test', async (context) => {
  const { client } = await chromePreset(context, {
    url: 'https://example.com'
  });
  // ... test code
});
```

**Lines of code:** 7 → 2 (71% reduction)

### Pattern 2: Manual Dashcam Control

```javascript
// OLD
test('dashcam test', async ({ client }) => {
  await authDashcam(client);
  await startDashcam(client);
  // ... test code
  const url = await stopDashcam(client);
  console.log(url);
});

// NEW
import { Dashcam } from 'testdriverai/core';

test('dashcam test', async (context) => {
  const dashcam = new Dashcam(client);
  await dashcam.auth();
  await dashcam.start();
  // ... test code
  const url = await dashcam.stop();
  console.log(url);
});
```

### Pattern 3: Custom Application Setup

```javascript
// OLD
test('custom app', async ({ client }) => {
  await authDashcam(client);
  await startDashcam(client);
  await client.exec('sh', 'myapp --arg1 --arg2 &', 30000);
  await client.focusApplication('MyApp');
  // ... test code
  await stopDashcam(client);
});

// NEW - Create custom preset
import { createPreset } from 'testdriverai/presets';

const myAppPreset = createPreset({
  name: 'My App',
  defaults: { args: [] },
  async setup(context, client, dashcam, options) {
    const { args = [] } = options;
    const argsStr = args.join(' ');
    await client.exec('sh', `myapp ${argsStr} &`, 30000);
    await client.focusApplication('MyApp');
    return {}; // client is returned automatically
  }
});

test('custom app', async (context) => {
  const { client } = await myAppPreset(context, {
    args: ['--arg1', '--arg2']
  });
  // ... test code
  // Auto-cleanup
});
```

**Reusable** - Use `myAppPreset` in all your tests!

## TypeScript Support

v7 includes full TypeScript definitions:

```typescript
import { test } from 'vitest';
import { chromePreset, ChromePresetOptions } from 'testdriverai/presets';
import { useTestDriver, UseDashcamOptions } from 'testdriverai/vitest/hooks';
import { Dashcam, DashcamOptions } from 'testdriverai/core';

// Full autocomplete and type checking!
test('typed test', async (context) => {
  const { client } = await chromePreset(context, {
    url: 'https://example.com',
    maximized: true,
    os: 'linux' // Type-safe: only 'linux' | 'mac' | 'windows'
  });
  
  await client.find('button').click();
});
```

## Breaking Changes

### None! 🎉

v7 is **100% backward compatible**. All existing code continues to work.

The old lifecycle helpers (`authDashcam`, `startDashcam`, `stopDashcam`) are marked as deprecated but fully functional.

## Deprecation Timeline

- **v7.0** - New APIs introduced, old helpers work (with deprecation warnings)
- **v7.x** - Old helpers continue to work
- **v8.0** - Old helpers removed (TBD, at least 6 months notice)

## Getting Help

- 📖 **Hooks Documentation**: See `/docs/HOOKS.md`
- 📖 **Presets Documentation**: See `/docs/PRESETS.md`
- 💬 **Examples**: See `/testdriver/acceptance-sdk/*-example.test.mjs`
- 🐛 **Issues**: GitHub Issues

## Summary

**Choose your level:**

| Level | Best For | Example |
|-------|----------|---------|
| **Presets** | Common apps (Chrome, VS Code) | `chromePreset(context, { url })` |
| **Hooks** | Custom lifecycle, power users | `useTestDriver(context, options)` |
| **Core** | Advanced control, debugging | `new Dashcam(client)` |

**Recommendation:** Start with presets for common scenarios, use hooks for custom needs, drop to core classes only when necessary.

Migration is **optional** - your existing code continues to work!
