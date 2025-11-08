# How to Get YAML --heal Behavior in Vitest + SDK

## Summary

You now have two new test helpers that replicate the YAML test runner's debugging capabilities:

### 1. **`createStepTracker()`** - Know where you are in execution

Replaces YAML's step-by-step visibility:

```javascript
const tracker = createStepTracker('Login Test');

await tracker.step('Navigate to login', async () => {
  await client.assert('login page is visible');
});

await tracker.step('Enter credentials', async () => {
  await client.hoverText('Username');
  await client.type('user@test.com');
});
```

**When a step fails, you see:**
```
✅ Step 1: Navigate to login (234ms)
❌ Step 2: Enter credentials (123ms)
   Error: Element not found
```

### 2. **`withErrorRecovery()`** - AI healing on failure

Replaces YAML's `--heal` and `--write` flags:

```javascript
// Wrap your client with error recovery
const healingClient = withErrorRecovery(client, {
  maxRetries: 3,
  captureOnError: true,
  writeOnRecovery: true,  // Rewrite test file with AI fixes (like --write)
});

// Now commands auto-recover on failure AND rewrite the file
await healingClient.hoverText('Submit');
await healingClient.type('test data');
```

**When a command fails:**
```
⚠️  Error in hoverText: Element not found
   Attempting AI recovery (attempt 1/3)...
   ✨ AI suggested recovery steps
   📝 Rewriting test file: quick-start-recovery.test.mjs
   💾 Backup saved: quick-start-recovery.test.mjs.backup.1730995200000
   ✅ Test file updated with AI suggestion
   💡 Review changes and restore from backup if needed
   Retrying hoverText...
   ✅ Success!
```

## Quick Migration Examples

### Before (YAML with --heal)
```yaml
steps:
  - prompt: navigate to login
    commands:
      - command: assert
        expect: login page is visible
  
  - prompt: enter credentials
    commands:
      - command: hover-text
        text: Username
      - command: type
        text: user@test.com
```

Run: `npx testdriverai run test.yaml --heal`

### After (Vitest with SDK)
```javascript
it('should login', async () => {
  const tracker = createStepTracker('Login');
  const healingClient = withErrorRecovery(client, { 
    maxRetries: 3,
    writeOnRecovery: true  // Rewrite file on recovery
  });

  await tracker.step('navigate to login', async () => {
    await healingClient.assert('login page is visible');
  });

  await tracker.step('enter credentials', async () => {
    await healingClient.hoverText('Username');
    await healingClient.type('user@test.com');
  });
});
```

## What You Get

| YAML Feature | Vitest Equivalent |
|-------------|-------------------|
| Step-by-step execution | `createStepTracker()` |
| `--heal` flag (AI recovery) | `withErrorRecovery()` |
| `--write` flag (rewrite on fix) | `writeOnRecovery: true` option |
| Know which step failed | Step tracker shows exact step number |
| Error context on failure | Execution history in console |
| Screenshot on error | `captureOnError: true` option |
| Retry logic | `maxRetries` option |
| File backup on rewrite | Automatic `.backup.timestamp` files |

## Files Added

1. **`testHelpers.mjs`** - Updated with new functions:
   - `withErrorRecovery()` - Wrap client for auto-healing
   - `createStepTracker()` - Track test steps

2. **`ERROR_RECOVERY_GUIDE.md`** - Complete documentation

3. **`error-recovery-example.test.mjs`** - Full example

4. **`quick-start-recovery.test.mjs`** - Simple examples

## Next Steps

1. **Try the examples:**
   ```bash
   npx vitest run testdriver/acceptance-sdk/quick-start-recovery.test.mjs
   ```

2. **Update your existing tests:**
   - Add step tracking for visibility
   - Wrap client with error recovery for auto-healing

3. **Read the guide:**
   - See `ERROR_RECOVERY_GUIDE.md` for detailed examples
