---
name: caching
description: Understand TestDriver element caching. Use when optimizing test speed, managing cache keys, or troubleshooting cached element issues.
---

# Element Caching

Read: `node_modules/testdriverai/docs/v7/caching.mdx`

## How Caching Works

TestDriver caches element locations to speed up subsequent test runs. When you `find()` an element, the result is stored and reused in future runs.

## Cache Options

```javascript
const testdriver = TestDriver(context, {
  cache: true,           // Enable caching (default: true)
  cacheKey: 'my-test',   // Custom cache key
});
```

## When to Use Custom Cache Keys

Use different cache keys when:
- Testing different pages/states with similar elements
- Running tests in different environments
- Elements have different positions in different contexts

```javascript
// Login page test
const testdriver = TestDriver(context, { cacheKey: 'login-page' });

// Dashboard test
const testdriver = TestDriver(context, { cacheKey: 'dashboard' });
```

## Disabling Cache

Disable caching when:
- Elements frequently change position
- Debugging element detection issues
- Dynamic content that varies between runs

```javascript
const testdriver = TestDriver(context, { cache: false });
```

## Cache Invalidation

The cache is automatically invalidated when:
- Element is not found at cached location
- Test fails due to element mismatch
- Cache key changes

## Troubleshooting

**Element found at wrong position?**
- Try disabling cache: `cache: false`
- Use a different cache key
- The UI may have changed since last run

**Tests slower than expected?**
- Ensure caching is enabled
- Use consistent cache keys
- Cache builds up over successful runs
