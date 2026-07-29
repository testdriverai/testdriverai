---
name: testdriver:caching
description: How TestDriver learns your app and caches what it discovers for instant, deterministic replays
---
<!-- Generated from caching.mdx. DO NOT EDIT. -->

Once the agent has [explored your app](/v7/generating-tests), TestDriver remembers what it found. Every element the AI vision agent discovers is cached with a vision fingerprint—a perceptual hash of the screen state where it was located. On the next run, TestDriver matches against that cache instead of calling the AI again. Passing tests replay instantly, deterministically, and cheaply.

This learning is what makes TestDriver fast. Intelligent caching delivers up to **1.7x faster** test execution by skipping redundant AI vision analysis—the agent only thinks when it sees something new.

```javascript
// First run: builds cache
await testdriver.find('submit button');

// Second run: exact match
await testdriver.find('submit button');
``` 

## Automatic Caching

Learning is enabled automatically with zero configuration. The cache key—the fingerprint TestDriver uses to recognize what it already knows—is computed from:

- **File hash**: SHA-256 hash of the test file contents
- **Selector prompt**: The exact text description passed to `find()`
- **Screenshot context**: Perceptual hash of the current screen state
- **Platform**: Operating system and browser version

When you modify your test file, the hash changes automatically, invalidating stale cache entries and ensuring fresh AI analysis with your updated test logic.

```javascript
import { test } from 'vitest';
import { chrome } from 'testdriverai/presets';

test('auto-cached test', async (context) => {
  const { testdriver } = await chrome(context, {
    url: 'https://example.com'
  });

  // First call: AI analyzes screen, saves to cache
  await testdriver.find('More information link'); // 2.1s

  // Second call: cache hit, instant response
  await testdriver.find('More information link'); // 12ms ⚡
});
```

## Managing the Cache

You can clear the cache within the TestDriver console. There, you'll also find previews of cached elements, the input prompts, as well as analytics on cache hit rates.

<Card href="https://console.testdriver.ai/cache" title="TestDriver Cache" icon="database">
  Manage and clear your test cache from the TestDriver console.
</Card>

## Debugging Cache Hits and Misses

You can track what TestDriver has learned by inspecting cache performance in your tests:

```javascript
test('monitor cache performance', async (context) => {
  const { testdriver } = await chrome(context, { url });

  const element = await testdriver.find('submit button');

  if (element.cacheHit) {
    console.log('✅ Cache hit - instant response');
    console.log('Strategy:', element.cacheStrategy); // 'exact', 'pixeldiff', or 'template'
    console.log('Similarity:', `${(element.similarity * 100).toFixed(1)}%`);
    console.log('Cache age:', element.cacheCreatedAt);
  } else {
    console.log('⏱️  Cache miss - AI analysis performed');
    console.log('New cache entry created');
  }
});
```

## Configuring the Cache

You can configure how TestDriver learns globally when initializing TestDriver:

```javascript
import { TestDriver } from 'testdriverai';

const testdriver = new TestDriver({
  apiKey: process.env.TD_API_KEY,
  cacheKey: 'my-test-suite', // cache-key for this instance
  cacheDefaults: {
    threshold: 0.05,      // 95% similarity
  }
});
```

It's also possible to override cache settings per `find()` call:

```javascript
// Default: 95% similarity required
await testdriver.find('submit button');

// Explicit strict threshold
await testdriver.find('submit button', {
  cacheThreshold: 0.01 // 99% similarity
});
```

## Caching with Variables

Custom cache keys prevent cache pollution when using variables in prompts, dramatically improving cache hit rates—so TestDriver reuses what it learned even when your data changes.

```javascript
// ❌ Without cache key - creates new cache for each variable value
const email = 'user@example.com';
await testdriver.find(`input for ${email}`); // Cache miss every time

// ✅ With cache key - reuses cache regardless of variable
const email = 'user@example.com';
await testdriver.find(`input for ${email}`, {
  cacheKey: 'email-input'
});

// Also useful for dynamic IDs, names, or other changing data
const orderId = generateOrderId();
await testdriver.find(`order ${orderId} status`, {
  cacheKey: 'order-status'  // Same cache for all orders
});
```

## Next

<Card href="/v7/copilot/running-tests" title="Run" icon="play">
  Now that TestDriver has learned your app, run your tests in CI and locally—replaying the cache for fast, deterministic results.
</Card>
