# wait() Deprecation and Best Practices

## Summary

We've deprecated the use of `wait()` in favor of element polling with `find()`. This change improves test reliability, reduces flakiness, and makes tests faster.

## Changes Made

### 1. Test Refactoring (`testdriver/acceptance-sdk/sully-ai.test.mjs`)

- ✅ Removed all 14+ instances of `wait()` calls
- ✅ Replaced with element polling using helper function `waitForElement()`
- ✅ Added `waitForElement()` helper function for reusable polling logic
- ✅ Fixed all linting errors (unused variables in catch blocks)

**Before:**
```javascript
await testdriver.wait(2000);
const button = await testdriver.find("Submit button");
```

**After:**
```javascript
const button = await waitForElement(testdriver, "Submit button");
```

### 2. MCP Server Updates (`mcp-server/src/index.ts`)

Updated the `testdriver_wait` tool description to strongly discourage usage:

```typescript
{
  name: "testdriver_wait",
  description:
    "⚠️ DEPRECATED - DO NOT USE. Instead of wait(), use find() in a polling loop to wait for elements. Example: `let el; for (let i = 0; i < 10; i++) { try { el = await find('button'); if (el.found()) break; } catch {} await new Promise(r => setTimeout(r, 1000)); }`. Arbitrary waits make tests brittle and slow. Only use wait() if absolutely necessary for timing-dependent operations that cannot be detected via UI state.",
  inputSchema: WaitSchema,
}
```

This ensures AI assistants using the MCP protocol will see the deprecation warning and avoid generating `wait()` calls.

### 3. Documentation (`docs/guide/best-practices-polling.mdx`)

Created comprehensive best practices documentation covering:

- ✅ Why to avoid `wait()`
- ✅ Proper element polling patterns
- ✅ Reusable helper function examples
- ✅ Real-world usage examples
- ✅ Configuration guidelines for different scenarios
- ✅ Conditional polling for optional elements

## Helper Function Pattern

```javascript
async function waitForElement(testdriver, description, maxAttempts = 10, delayMs = 1000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const element = await testdriver.find(description);
      if (element.found()) {
        return element;
      }
    } catch (e) {
      if (i === maxAttempts - 1) throw e;
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  throw new Error(`Element not found after ${maxAttempts} attempts: ${description}`);
}
```

## Benefits

1. **More Reliable**: Tests fail fast if elements truly don't exist
2. **Faster**: No waiting for arbitrary timeouts when elements appear quickly
3. **Better Errors**: Clear error messages when elements aren't found
4. **Self-Documenting**: Polling code clearly shows what the test is waiting for
5. **Flexible**: Easy to adjust polling frequency and timeout per element

## Migration Guide

For existing tests using `wait()`:

1. Identify why the wait was added (page load, UI update, etc.)
2. Find the element that indicates the state you're waiting for
3. Replace `wait()` with element polling for that indicator

**Example:**

```javascript
// Before: Waiting for page to load
await testdriver.wait(2000);
const dashboard = await testdriver.find("Dashboard");

// After: Poll for the dashboard element
const dashboard = await waitForElement(testdriver, "Dashboard");
```

## Next Steps

- [ ] Update all existing tests to use element polling
- [ ] Add `waitForElement()` helper to test utilities/presets
- [ ] Consider marking `wait()` as fully deprecated in SDK
- [ ] Add ESLint rule to warn about `wait()` usage in tests

## Related Files

- Test file: `/Users/ianjennings/Development/cli/testdriver/acceptance-sdk/sully-ai.test.mjs`
- MCP server: `/Users/ianjennings/Development/cli/mcp-server/src/index.ts`
- Documentation: `/Users/ianjennings/Development/cli/docs/guide/best-practices-polling.mdx`
