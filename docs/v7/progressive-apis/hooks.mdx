# Hooks API

React-style hooks for managing TestDriver and Dashcam lifecycle in Vitest tests.

## Overview

Hooks provide automatic lifecycle management - no more forgetting to disconnect or stop recording. They integrate seamlessly with Vitest's test context.

```javascript
import { test } from 'vitest';
import { useTestDriver, useDashcam } from 'testdriverai/vitest/hooks';

test('my test', async (context) => {
  const client = useTestDriver(context, { os: 'linux' });
  const dashcam = useDashcam(context, client, {
    autoStart: true,
    autoStop: true
  });
  
  // Test code here
  // Automatic cleanup at test end!
});
```

## Available Hooks

### useTestDriver

Creates and manages a TestDriver instance with automatic cleanup.

```javascript
import { useTestDriver } from 'testdriverai/vitest/hooks';

test('my test', async (context) => {
  const client = useTestDriver(context, {
    os: 'linux',           // Target OS (default: 'linux')
    autoConnect: true,     // Auto-connect to sandbox (default: true)
    apiKey: process.env.TD_API_KEY,
    apiRoot: 'https://...',
    resolution: '1366x768',
    analytics: true
  });
  
  // Client is ready to use
  await client.find('button').click();
  
  // Auto-disconnects at test end
});
```

**Parameters:**
- `context` - Vitest test context (required)
- `options` - TestDriver configuration options

**Options:**
- `os` - Target OS: `'linux'`, `'mac'`, or `'windows'` (default: `'linux'`)
- `autoConnect` - Automatically connect to sandbox (default: `true`)
- `apiKey` - TestDriver API key (default: `process.env.TD_API_KEY`)
- `apiRoot` - API endpoint URL
- `resolution` - Screen resolution (default: `'1366x768'`)
- `analytics` - Enable analytics (default: `true`)
- `cacheThresholds` - Cache settings for find operations

**Returns:**
- TestDriver instance, ready to use

### useDashcam

Creates and manages a Dashcam instance with optional auto-lifecycle.

```javascript
import { useDashcam } from 'testdriverai/vitest/hooks';

test('my test', async (context) => {
  // Assuming you have a client from useTestDriver
  const dashcam = useDashcam(context, client, {
    autoAuth: true,    // Auto-authenticate (default: true)
    autoStart: true,   // Auto-start recording (default: false)
    autoStop: true,    // Auto-stop at test end (default: false)
    apiKey: process.env.TD_API_KEY  // Optional - uses TD_API_KEY by default
  });
  
  // If autoStart is false, manually start:
  // await dashcam.start();
  
  // Your test code
  
  // If autoStop is true, URL is saved automatically
  // Otherwise, manually stop:
  // const url = await dashcam.stop();
});
```

**Parameters:**
- `context` - Vitest test context (required)
- `client` - TestDriver instance from `useTestDriver()` (required)
- `options` - Dashcam configuration options

**Options:**
- `autoAuth` - Automatically authenticate (default: `true`)
- `autoStart` - Automatically start recording (default: `false`)
- `autoStop` - Automatically stop recording at test end (default: `false`)
- `apiKey` - API key (default: `process.env.TD_API_KEY`, same as TestDriver)

**Returns:**
- Dashcam instance

### useTestDriverWithDashcam

Combined hook for the simplest usage - everything automatic.

```javascript
import { useTestDriverWithDashcam } from 'testdriverai/vitest/hooks';

test('my test', async (context) => {
  const { client, dashcam } = useTestDriverWithDashcam(context, {
    os: 'linux',
    // All TestDriver options +
    // All Dashcam options (autoAuth, autoStart, autoStop all true by default)
  });
  
  // Everything is ready - just write your test!
  await client.find('button').click();
  
  // Dashcam auto-stops, client auto-disconnects
});
```

**Parameters:**
- `context` - Vitest test context (required)
- `options` - Combined TestDriver and Dashcam options

**Returns:**
- `{ client, dashcam }` - Both instances, fully configured

## Complete Examples

### Basic Test with Hooks

```javascript
import { describe, it, expect } from 'vitest';
import { useTestDriver } from 'testdriverai/vitest/hooks';

describe('Search Tests', () => {
  it('should search successfully', async (context) => {
    const client = useTestDriver(context, { os: 'linux' });
    
    await client.focusApplication('Google Chrome');
    await client.find('search box').type('testdriverai');
    await client.pressKeys(['enter']);
    
    const result = await client.assert('search results appear');
    expect(result).toBeTruthy();
  });
});
```

### With Dashcam Recording

```javascript
import { useTestDriver, useDashcam } from 'testdriverai/vitest/hooks';

test('recorded test', async (context) => {
  const client = useTestDriver(context, { os: 'linux' });
  const dashcam = useDashcam(context, client, {
    autoAuth: true,
    autoStart: true,
    autoStop: true  // URL saved automatically
  });
  
  await client.focusApplication('Google Chrome');
  await client.find('button').click();
  
  // Dashcam URL will be in test results
});
```

### Fully Automatic

```javascript
import { useTestDriverWithDashcam } from 'testdriverai/vitest/hooks';

test('automatic everything', async (context) => {
  const { client } = useTestDriverWithDashcam(context);
  
  await client.focusApplication('Google Chrome');
  await client.find('login').click();
  
  // Dashcam + TestDriver managed automatically
});
```

### Manual Control (Advanced)

```javascript
import { useTestDriver, useDashcam } from 'testdriverai/vitest/hooks';

test('manual control', async (context) => {
  const client = useTestDriver(context, {
    os: 'linux',
    autoConnect: false  // We'll connect manually
  });
  
  // Manual connection
  await client.auth();
  await client.connect({ new: true });
  
  const dashcam = useDashcam(context, client, {
    autoAuth: true,
    autoStart: false,  // Manual start
    autoStop: false    // Manual stop
  });
  
  // Start recording when ready
  await dashcam.start();
  
  await client.find('button').click();
  
  // Stop and get URL
  const url = await dashcam.stop();
  console.log('Replay:', url);
  
  // Cleanup still automatic!
});
```

## How Hooks Work

Hooks use Vitest's `context.onTestFinished()` to register cleanup handlers:

```javascript
// Internally, hooks do this:
export function useTestDriver(context, options = {}) {
  const client = new TestDriver(apiKey, options);
  
  // Register cleanup
  context.onTestFinished(async () => {
    await client.disconnect();
  });
  
  return client;
}
```

This ensures cleanup always runs, even if your test fails.

## TypeScript Support

```typescript
import { useTestDriver, UseDashcamOptions } from 'testdriverai/vitest/hooks';

test('typed test', async (context) => {
  const client = useTestDriver(context, {
    os: 'linux',  // ✅ Type-safe
    resolution: '1920x1080'
  });
  
  const dashcamOptions: UseDashcamOptions = {
    autoAuth: true,
    autoStart: true,
    autoStop: true
    // apiKey is optional - uses TD_API_KEY by default
  };
  
  const dashcam = useDashcam(context, client, dashcamOptions);
});
```

## When to Use Hooks

**Use hooks when:**
- You want automatic cleanup
- You're testing with Vitest
- You need custom lifecycle control
- You're a power user who understands the lifecycle

**Use `provision()` instead when:**
- You're testing Chrome, VS Code, or Electron
- You want zero configuration
- You're a beginner
- You want the simplest API

**Use core classes directly when:**
- You need full manual control
- You're not using Vitest
- You're debugging lifecycle issues

## Best Practices

1. **Always pass context** - Required for automatic cleanup
2. **One client per test** - Don't share clients between tests
3. **Use autoStart/autoStop for Dashcam** - Unless you have specific timing needs
4. **Leverage TypeScript** - Get autocomplete and catch errors early
5. **Keep options in variables** - Easier to maintain and reuse

## Common Patterns

### Shared Setup

```javascript
function setupBrowser(context) {
  const client = useTestDriver(context, { os: 'linux' });
  const dashcam = useDashcam(context, client, {
    autoAuth: true,
    autoStart: true,
    autoStop: true
  });
  return { client, dashcam };
}

test('test 1', async (context) => {
  const { client } = setupBrowser(context);
  // ...
});

test('test 2', async (context) => {
  const { client } = setupBrowser(context);
  // ...
});
```

### Conditional Dashcam

```javascript
test('maybe record', async (context) => {
  const client = useTestDriver(context);
  
  const shouldRecord = process.env.RECORD_TESTS === 'true';
  const dashcam = shouldRecord 
    ? useDashcam(context, client, { autoStart: true, autoStop: true })
    : null;
  
  // Test code...
});
```

## Error Handling

Cleanup runs even if your test fails:

```javascript
test('failing test', async (context) => {
  const client = useTestDriver(context);
  
  try {
    await client.find('nonexistent element').click();
  } catch (error) {
    console.error('Test failed:', error);
    throw error;  // Test marked as failed
  }
  
  // client.disconnect() still runs automatically
});
```

## See Also

- [Provision API](./PROVISION.md) - Simpler API for common apps
- [Core Classes](./CORE.md) - Manual control
- [Migration Guide](../MIGRATION.md) - Upgrading from v6
