# Progressive Disclosure APIs

TestDriver v7 introduces **progressive disclosure** - three levels of API to match your experience and needs.

## Choose Your Level

### 🟢 Beginner: Provision API

**Best for:** Getting started, testing common apps (Chrome, VS Code, Electron)

```javascript
import { provision } from 'testdriverai/presets';

test('my test', async (context) => {
  const { testdriver } = await provision('chrome', {
    url: 'https://example.com'
  }, context);
  
  await testdriver.find('Login').click();
});
```

**Why use this:**
- ✅ Zero configuration
- ✅ One line setup
- ✅ Automatic everything (launch, focus, cleanup, recording)
- ✅ Perfect for beginners

[Learn more →](./PROVISION.md)

---

### 🟡 Intermediate: Hooks API

**Best for:** Power users, custom workflows, manual lifecycle control

```javascript
import { useTestDriver, useDashcam } from 'testdriverai/vitest/hooks';

test('my test', async (context) => {
  const client = useTestDriver(context, { os: 'linux' });
  const dashcam = useDashcam(context, client, {
    autoStart: true,
    autoStop: true
  });
  
  await client.find('button').click();
});
```

**Why use this:**
- ✅ Automatic cleanup
- ✅ Flexible configuration
- ✅ Control over lifecycle
- ✅ Works with any application

[Learn more →](./HOOKS.md)

---

### 🔴 Advanced: Core Classes

**Best for:** Full control, non-Vitest frameworks, custom integrations

```javascript
import { TestDriver, Dashcam } from 'testdriverai/core';

const client = new TestDriver(apiKey, { os: 'linux' });
await client.auth();
await client.connect();

const dashcam = new Dashcam(client);
await dashcam.start();

// Your code

await dashcam.stop();
await client.disconnect();
```

**Why use this:**
- ✅ Complete manual control
- ✅ No framework dependencies
- ✅ Works anywhere
- ✅ Maximum flexibility

[Learn more →](./CORE.md)

---

## Architecture

```
┌─────────────────────────────────────────────┐
│          🟢 Provision API (Easiest)         │
│   provision('chrome', options, context)     │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│        🟡 Hooks API (Flexible)              │
│   useTestDriver(), useDashcam()             │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│    🔴 Core Classes (Full Control)           │
│   new TestDriver(), new Dashcam()           │
└─────────────────────────────────────────────┘
```

Each level builds on the one below it. Choose the highest level that meets your needs.

## Quick Comparison

| Feature | Provision | Hooks | Core |
|---------|-----------|-------|------|
| Setup complexity | ⭐ 1 line | ⭐⭐ 2-3 lines | ⭐⭐⭐ 5+ lines |
| Cleanup | ✅ Automatic | ✅ Automatic | ❌ Manual |
| Framework requirement | Vitest | Vitest | None |
| Application support | Chrome, VS Code, Electron | Any | Any |
| Launch application | ✅ Automatic | ❌ Manual | ❌ Manual |
| Dashcam recording | ✅ Automatic | ⚡ Optional automatic | ❌ Manual |
| TypeScript support | ✅ Full | ✅ Full | ✅ Full |
| Customization | ⚡ Limited | ✅ High | ✅ Complete |

## When to Use Each

### Use Provision API when:
- ✅ Testing Chrome, VS Code, or Electron
- ✅ You're a beginner
- ✅ You want the simplest possible code
- ✅ You're okay with defaults

### Use Hooks API when:
- ✅ You need custom application launch
- ✅ You want automatic cleanup
- ✅ You're using Vitest
- ✅ You need fine-grained lifecycle control

### Use Core Classes when:
- ✅ Not using Vitest
- ✅ Integrating with other frameworks
- ✅ Building custom abstractions
- ✅ Debugging lifecycle issues
- ✅ Need complete manual control

## Examples

### Simple Chrome Test

**Provision (1 line):**
```javascript
const { testdriver } = await provision('chrome', { url }, context);
```

**Hooks (3 lines):**
```javascript
const client = useTestDriver(context);
await client.exec('sh', 'google-chrome "https://..." &', 30000);
await client.focusApplication('Google Chrome');
```

**Core (6+ lines):**
```javascript
const client = new TestDriver(apiKey, { os: 'linux' });
await client.auth();
await client.connect();
await client.exec('sh', 'google-chrome "https://..." &', 30000);
await client.focusApplication('Google Chrome');
// ... test code ...
await client.disconnect();
```

### With Dashcam Recording

**Provision (1 line):**
```javascript
const { testdriver, dashcam } = await provision('chrome', { url }, context);
// Recording automatic!
```

**Hooks (2 lines):**
```javascript
const client = useTestDriver(context);
const dashcam = useDashcam(context, client, { autoStart: true, autoStop: true });
```

**Core (7+ lines):**
```javascript
const client = new TestDriver(apiKey);
await client.auth();
await client.connect();
const dashcam = new Dashcam(client);
await dashcam.auth();
await dashcam.start();
// ... test code ...
await dashcam.stop();
await client.disconnect();
```

## Migration Path

Start simple, grow as needed:

1. **Start with Provision** - Get tests working quickly
2. **Move to Hooks** - When you need custom app launch
3. **Use Core** - Only if you need full control or non-Vitest

You can mix and match in the same project!

## Package Exports

All three APIs are available from the same package:

```javascript
// Provision API
import { provision, chrome, vscode, electron } from 'testdriverai/presets';

// Hooks API
import { useTestDriver, useDashcam } from 'testdriverai/vitest/hooks';

// Core Classes
import { TestDriver, Dashcam } from 'testdriverai/core';
```

## See Also

- [Provision API Reference](./PROVISION.md)
- [Hooks API Reference](./HOOKS.md)
- [Core Classes Reference](./CORE.md)
- [Migration Guide](../MIGRATION.md)
