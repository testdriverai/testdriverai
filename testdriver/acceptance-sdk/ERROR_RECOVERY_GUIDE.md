# Error Recovery in Vitest + SDK Tests

This guide shows how to achieve the same error recovery and debugging capabilities from YAML tests (with `--heal` flag) in Vitest + JS SDK tests.

## The Problem

With YAML tests, you had:
- **Step-by-step execution tracking**: Know exactly which step failed
- **AI-powered error recovery**: `--heal` flag would rewrite steps on failure
- **Context awareness**: Could see execution history when errors occurred

With Vitest + JS SDK, you need to implement this explicitly.

## The Solutions

### 1. Step Tracking (Know Where You Failed)

Use `createStepTracker()` to get visibility into which step failed:

```javascript
import { createStepTracker } from './setup/testHelpers.mjs';

it('should login', async () => {
  const tracker = createStepTracker('Login Test');

  await tracker.step('Navigate to login', async () => {
    await client.assert('login page is visible');
  });

  await tracker.step('Enter username', async () => {
    await client.hoverText('Username');
    await client.type('user@test.com');
  });

  await tracker.step('Submit form', async () => {
    await client.pressKeys(['enter']);
  });
  
  // If step 2 fails, you'll see:
  // ✅ Step 1: Navigate to login (234ms)
  // ❌ Step 2: Enter username (123ms)
  //    Error: Element not found
});
```

**Output when a step fails:**
```
📍 Step 1: Navigate to login
   ✅ Passed (234ms)

📍 Step 2: Enter username
   ❌ Failed at step 2: Enter username
   Error: Element not found

📊 Test Progress (Login Test):
   ✅ Step 1: Navigate to login (234ms)
   ❌ Step 2: Enter username (123ms)
```

### 2. AI-Powered Error Recovery (Like --heal)

Use `withErrorRecovery()` to wrap your client with automatic AI healing:

```javascript
import { withErrorRecovery } from './setup/testHelpers.mjs';

describe('My Test', () => {
  let client;
  let healingClient;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
    
    // Wrap with error recovery (like --heal --write in YAML)
    healingClient = withErrorRecovery(client, {
      maxRetries: 3,           // Retry up to 3 times
      captureOnError: true,    // Screenshot on errors
      writeOnRecovery: true,   // Rewrite test file with AI fixes
    });
  });

  it('should auto-heal on errors', async () => {
    // Use healingClient instead of client
    // If this fails:
    // 1. AI will attempt to fix it
    // 2. This test file will be rewritten with the fix
    // 3. A backup will be created
    await healingClient.hoverText('Submit Button');
    await healingClient.type('test data');
  });
});
```

**What happens on error:**
```
⚠️  Error in hoverText: Element not found: Submit Button
   Attempting AI recovery (attempt 1/3)...
   ✨ AI suggested recovery steps
   📝 Rewriting test file: my-test.test.mjs
   💾 Backup saved: my-test.test.mjs.backup.1730995200000
   ✅ Test file updated with AI suggestion
   💡 Review changes and restore from backup if needed
   Retrying hoverText...
   ✅ Success after recovery!
```

**File rewriting behavior:**
- Creates timestamped backups before modifying files
- Adds comments indicating AI fixes with timestamps
- If exact replacement fails, appends suggestions as comments
- Automatically detects test file path from stack trace

### 3. Combine Both for Maximum Debugging

```javascript
it('should have full visibility and auto-recovery', async () => {
  const tracker = createStepTracker('Complex Flow');

  // Each step is tracked AND auto-recovers on failure
  await tracker.step('Login', async () => {
    await healingClient.hoverText('Username');
    await healingClient.type('user@test.com');
  });

  await tracker.step('Navigate', async () => {
    await healingClient.hoverText('Dashboard');
    await healingClient.click();
  });
});
```

## Custom Error Handling

You can add custom error handlers to log to external systems:

```javascript
healingClient = withErrorRecovery(client, {
  maxRetries: 3,
  onError: async (error, commandInfo, errorCount) => {
    // Custom logging
    console.log(`Error in ${commandInfo.method}`);
    console.log(`Attempt ${errorCount}`);
    
    // Send to monitoring system
    await sendToSentry({ error, command: commandInfo });
  },
  onRecovery: async (error, commandInfo, errorCount) => {
    // Track recovery attempts
    await logRecoveryAttempt(commandInfo.method, errorCount);
  }
});
```

## Accessing Execution History

Both features track execution history:

```javascript
// Step tracker provides summary
const summary = tracker.getSummary();
console.log(`Passed: ${summary.passed}/${summary.totalSteps}`);
summary.steps.forEach(step => {
  console.log(`Step ${step.step}: ${step.description} - ${step.status}`);
});
```

## Comparison: YAML vs Vitest

### YAML Test (old way)
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

Run with: `npx testdriverai run test.yaml --heal`

### Vitest Test (new way)
```javascript
it('should login', async () => {
  const tracker = createStepTracker('Login');
  
  await tracker.step('navigate to login', async () => {
    await healingClient.assert('login page is visible');
  });
  
  await tracker.step('enter credentials', async () => {
    await healingClient.hoverText('Username');
    await healingClient.type('user@test.com');
  });
});
```

## Best Practices

1. **Use step tracker for complex tests**: Any test with >3 operations
2. **Use error recovery in CI**: Automatically handle flaky tests
3. **Combine both for debugging**: Maximum visibility during development
4. **Regular client for simple tests**: Don't over-engineer simple assertions

## Environment Variables

Control behavior with environment variables:

```bash
# Enable verbose logging to see recovery attempts
VERBOSE=true npx vitest run my-test.test.mjs

# See detailed event logs
DEBUG_EVENTS=true npx vitest run my-test.test.mjs

# Disable logging entirely
LOGGING=false npx vitest run my-test.test.mjs
```

## Example: Full Test with All Features

```javascript
import { afterAll, beforeAll, describe, it } from 'vitest';
import { 
  createTestClient, 
  setupTest, 
  teardownTest,
  withErrorRecovery,
  createStepTracker
} from './setup/testHelpers.mjs';

describe('Complete Example', () => {
  let client;
  let healingClient;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);
    
    healingClient = withErrorRecovery(client, {
      maxRetries: 3,
      captureOnError: true,
    });
  });

  afterAll(async () => {
    await teardownTest(client);
  });

  it('should complete complex workflow', async () => {
    const tracker = createStepTracker('E2E Flow');

    await tracker.step('Verify initial state', async () => {
      await healingClient.assert('login page is visible');
    });

    await tracker.step('Login', async () => {
      await healingClient.hoverText('Username');
      await healingClient.type('user@test.com');
      await healingClient.pressKeys(['tab']);
      await healingClient.type('password123');
      await healingClient.pressKeys(['enter']);
    });

    await tracker.step('Verify dashboard', async () => {
      await healingClient.waitForText('Welcome', 10000);
      await healingClient.assert('dashboard is displayed');
    });

    // Get summary
    const summary = tracker.getSummary();
    console.log(`Test completed: ${summary.passed}/${summary.totalSteps} passed`);
  });
});
```

## Troubleshooting

**Q: Error recovery isn't working**
- Ensure you're using `healingClient` (the wrapped client) not the original `client`
- Check that your API key is valid
- Verify maxRetries is > 0

**Q: Step tracker shows wrong step numbers**
- Make sure you create a new tracker for each test
- Don't reuse trackers across multiple tests

**Q: Too much logging**
- Set `logging: false` in client options
- Use `LOGGING=false` environment variable
