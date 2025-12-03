# Auto-Generated Cache Keys from File Hash

## Overview

When you create a TestDriver instance without providing an explicit `cacheKey`, the SDK will automatically generate one based on the SHA-256 hash of the calling file. This provides automatic cache invalidation when your test file changes, while enabling cache hits for identical test runs.

## How It Works

1. **Stack Trace Analysis**: When `TestDriver()` is called, the SDK analyzes the call stack to find the caller file
2. **File Hashing**: The content of the caller file is hashed using SHA-256
3. **Cache Key Generation**: The first 16 characters of the hash are used as the cache key
4. **Automatic Updates**: When the test file is modified, the hash changes, automatically invalidating the cache

## Benefits

- ✅ **No Manual Cache Management**: Cache keys are automatically generated and updated
- ✅ **File-Scoped Caching**: All tests in the same file share the same cache
- ✅ **Automatic Invalidation**: Cache is invalidated when the test file changes
- ✅ **Explicit Override**: You can still provide a manual `cacheKey` if needed

## Usage Examples

### Automatic Cache Key (Recommended)

```javascript
import { TestDriver } from 'testdriverai/vitest/hooks';

test('login test', async (context) => {
  // No cacheKey provided - will be auto-generated from this file's hash
  const testdriver = TestDriver(context, { 
    headless: true 
  });
  
  // Cache key is automatically set based on this file
  console.log(testdriver.options.cacheKey); // e.g., "4cae7be040f293b9"
  
  const button = await testdriver.find('login button');
  // Subsequent calls in this test file will use the same cache
});
```

### Explicit Cache Key (Override)

```javascript
import { TestDriver } from 'testdriverai/vitest/hooks';

test('login test', async (context) => {
  // Explicit cacheKey provided - auto-generation is skipped
  const testdriver = TestDriver(context, { 
    headless: true,
    cacheKey: 'my-custom-key-v1'
  });
  
  console.log(testdriver.options.cacheKey); // "my-custom-key-v1"
  
  const button = await testdriver.find('login button');
});
```

## Cache Behavior

### With Auto-Generated Key

1. **First Run**: Creates cache entries with key = hash of test file
2. **Subsequent Runs** (file unchanged): Cache hits
3. **After File Modification**: New hash = new cache key = cache miss

### Cache Hit Example

```javascript
// File: login.test.mjs (hash: 4cae7be040f293b9)

const testdriver = TestDriver(context);
// Auto-generated cacheKey: "4cae7be040f293b9"

const button1 = await testdriver.find('login button'); // Cache MISS (first time)
const button2 = await testdriver.find('login button'); // Cache HIT (same file, same test run)
```

After modifying the file (adding a comment, changing test logic, etc.):

```javascript
// File: login.test.mjs (hash: 7f3d9a2b1c5e8f6a) <- changed!

const testdriver = TestDriver(context);
// Auto-generated cacheKey: "7f3d9a2b1c5e8f6a" <- different from before

const button1 = await testdriver.find('login button'); // Cache MISS (new hash)
```

## Debug Mode

To see the auto-generated cache key in debug logs:

```bash
# Set environment variable
export TD_DEBUG=1

# Or in your test
process.env.TD_DEBUG = '1';
```

With debug mode enabled, you'll see:
```
🔍 find() threshold: 0.05 (cache ENABLED, cacheKey: 4cae7be040f293b9 (auto-generated from file hash))
```

## Implementation Details

### Stack Trace Filtering

The auto-generation skips the following in the stack trace to find the actual test file:
- `sdk.js` (TestDriver SDK)
- `hooks.mjs` / `hooks.js` (Vitest hooks)
- `node_modules` (dependencies)
- `node:internal` (Node.js internals)

### File Path Handling

The implementation handles both:
- Regular file paths: `/Users/you/project/test.mjs`
- File URL format: `file:///Users/you/project/test.mjs`

### Hash Format

- Algorithm: SHA-256
- Output: First 16 hexadecimal characters (e.g., `4cae7be040f293b9`)
- Collision probability: Effectively zero for practical purposes

## When to Use Manual Cache Keys

Consider using manual `cacheKey` values when:

1. **Cross-File Caching**: You want to share cache across multiple test files
2. **Version-Based Caching**: You want explicit control over cache invalidation
3. **CI/CD Integration**: You want to tie caching to build numbers or git commits

Example:

```javascript
const cacheKey = \`test-suite-\${process.env.GIT_COMMIT}\`;
const testdriver = TestDriver(context, { cacheKey });
```

## Migration from Manual Keys

If you currently use manual cache keys:

### Before
```javascript
const testdriver = TestDriver(context, { 
  cacheKey: 'login-test-v1' 
});
```

### After (automatic)
```javascript
// Just remove the cacheKey - it will be auto-generated!
const testdriver = TestDriver(context);
```

The cache will automatically invalidate when the test file changes, which is usually the desired behavior.

## See Also

- [SDK_README.md](./SDK_README.md) - Cache configuration options
- [CACHE_ARCHITECTURE.md](../api/CACHE_ARCHITECTURE.md) - Cache system architecture
