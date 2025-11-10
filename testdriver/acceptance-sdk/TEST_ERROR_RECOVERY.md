# Testing Error Recovery Feature

This guide explains how to test the error recovery and file rewriting functionality.

## Quick Test (Without Actual Errors)

### 1. Test Step Tracking Only

Run a simple test to verify step tracking works:

```bash
npx vitest run testdriver/acceptance-sdk/quick-start-recovery.test.mjs -t "should show which step failed"
```

**Expected output:**
- You'll see step numbers and descriptions
- All steps should pass (✅)
- Timing information for each step

### 2. Test With Working Commands

Run tests that should pass to verify the healing client doesn't interfere:

```bash
npx vitest run testdriver/acceptance-sdk/error-recovery-example.test.mjs
```

**Expected output:**
- All tests should pass
- No error recovery triggered
- Step tracking shows progress

## Testing Actual Error Recovery

To test the error recovery and file rewriting, you need to intentionally cause an error:

### Method 1: Create a Test with a Typo

Create a temporary test file:

```bash
cat > testdriver/acceptance-sdk/test-recovery-demo.test.mjs << 'EOF'
import { afterAll, beforeAll, describe, it } from 'vitest';
import { createTestClient, setupTest, teardownTest, withErrorRecovery } from './setup/testHelpers.mjs';

describe('Error Recovery Demo', () => {
  let client;
  let healingClient;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
    
    healingClient = withErrorRecovery(client, {
      maxRetries: 2,
      captureOnError: true,
      writeOnRecovery: true,
      testFilePath: 'testdriver/acceptance-sdk/test-recovery-demo.test.mjs'
    });
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it('should trigger error recovery', async () => {
    // This will fail because "Usernameeee" doesn't exist
    await healingClient.hoverText('Usernameeee', 'username field', 'click');
    await healingClient.type('test');
  });
});
EOF
```

### Run the test:

```bash
npx vitest run testdriver/acceptance-sdk/test-recovery-demo.test.mjs
```

**Expected behavior:**

1. **First attempt fails:**
   ```
   ⚠️  Error in hoverText: Element not found
      Attempting AI recovery (attempt 1/2)...
   ```

2. **AI analyzes the error:**
   ```
   ✨ AI suggested recovery steps
   ```

3. **File gets rewritten:**
   ```
   📝 Rewriting test file: test-recovery-demo.test.mjs
   💾 Backup saved: test-recovery-demo.test.mjs.backup.1730995200000
   ✅ Test file updated with AI suggestion
   💡 Review changes and restore from backup if needed
   ```

4. **Retry happens:**
   ```
   Retrying hoverText...
   ```

5. **Check the changes:**
   ```bash
   # See what changed
   diff testdriver/acceptance-sdk/test-recovery-demo.test.mjs.backup.* testdriver/acceptance-sdk/test-recovery-demo.test.mjs
   
   # Restore from backup if needed
   cp testdriver/acceptance-sdk/test-recovery-demo.test.mjs.backup.* testdriver/acceptance-sdk/test-recovery-demo.test.mjs
   ```

### Method 2: Use Environment Variable to Force Errors

Modify the test to use an environment variable:

```javascript
it('should trigger error recovery', async () => {
  const wrongText = process.env.FORCE_ERROR ? 'WrongElement' : 'Username';
  await healingClient.hoverText(wrongText, 'username field', 'click');
});
```

Run with:
```bash
FORCE_ERROR=true npx vitest run testdriver/acceptance-sdk/test-recovery-demo.test.mjs
```

## Verify Features Work

### ✅ Step Tracking
```bash
npx vitest run testdriver/acceptance-sdk/quick-start-recovery.test.mjs -t "Step Tracking"
```

Look for output like:
```
📍 Step 1: Check login page
   ✅ Passed (234ms)
📍 Step 2: Click username field
   ✅ Passed (156ms)
```

### ✅ Error History
When an error occurs, you should see:
```
📋 Execution history:
   ✅ focusApplication(...)
   ✅ assert(...)
   ❌ hoverText(...)
```

### ✅ File Backup
Check for backup files:
```bash
ls -la testdriver/acceptance-sdk/*.backup.*
```

### ✅ YAML to JS Conversion
Check the rewritten file contains JavaScript (not YAML):
```bash
grep -A5 "AI-fixed" testdriver/acceptance-sdk/test-recovery-demo.test.mjs
```

Should show something like:
```javascript
// AI-fixed (2025-11-07T..., attempt 1)
await healingClient.hoverText('Username', 'username field', 'click');
```

## Debug Mode

Enable verbose logging to see more details:

```bash
DEBUG_EVENTS=true VERBOSE=true npx vitest run testdriver/acceptance-sdk/test-recovery-demo.test.mjs
```

## Testing YAML to JS Conversion

You can test the conversion logic directly:

```javascript
// Create a test file: test-yaml-conversion.mjs
import { convertYamlCommandsToJs } from './testdriver/acceptance-sdk/setup/testHelpers.mjs';

const yamlData = {
  commands: [
    { command: 'hover-text', text: 'Submit', action: 'click' },
    { command: 'type', text: 'hello world' },
    { command: 'press-keys', keys: ['enter'] }
  ]
};

const js = convertYamlCommandsToJs(yamlData);
console.log('Converted JS:\n', js);
```

Run:
```bash
node test-yaml-conversion.mjs
```

Expected output:
```javascript
await healingClient.hoverText('Submit', 'click');
await healingClient.type('hello world');
await healingClient.pressKeys(['enter'])
```

## Common Issues

### Issue: "Could not auto-detect test file path"
**Solution:** Explicitly provide `testFilePath` option:
```javascript
healingClient = withErrorRecovery(client, {
  testFilePath: 'testdriver/acceptance-sdk/my-test.test.mjs'
});
```

### Issue: AI returns YAML but conversion fails
**Solution:** Check the console for "⚠️ Failed to parse YAML from AI" and inspect the AI response.

### Issue: File not being rewritten
**Solution:** Check that:
- `writeOnRecovery: true` is set
- The test file path is correct
- File permissions allow writing
- Backup files are being created

### Issue: Too many retries
**Solution:** Reduce `maxRetries`:
```javascript
healingClient = withErrorRecovery(client, { maxRetries: 1 });
```

## Cleanup

Remove test files and backups:
```bash
rm testdriver/acceptance-sdk/test-recovery-demo.test.mjs*
rm testdriver/acceptance-sdk/*.backup.*
```

## CI/CD Testing

In CI, you may want to disable file rewriting:

```javascript
healingClient = withErrorRecovery(client, {
  maxRetries: 3,
  captureOnError: true,
  writeOnRecovery: false  // Don't rewrite in CI
});
```

Or use an environment variable:
```javascript
healingClient = withErrorRecovery(client, {
  writeOnRecovery: !process.env.CI
});
```
