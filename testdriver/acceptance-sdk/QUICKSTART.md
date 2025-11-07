# Quick Start Guide - TestDriver SDK Tests

## TL;DR

```bash
# Install dependencies
npm install

# Set API key
export TD_API_KEY=your_api_key_here

# Run all tests
npm run test:sdk

# Run with logs visible
VERBOSE=true npm run test:sdk

# Run with all debug events
DEBUG_EVENTS=true VERBOSE=true npm run test:sdk

# Run with UI
npm run test:sdk:ui

# Run a single standalone script
node testdriver/acceptance-sdk/assert.js
```

## What's Available

### 22 Standalone SDK Scripts

Run directly with Node.js - great for learning and debugging:

```bash
node testdriver/acceptance-sdk/assert.js
node testdriver/acceptance-sdk/type.js
node testdriver/acceptance-sdk/scroll.js
# ... etc
```

### 7 Vitest Test Suites

Integrated tests with lifecycle hooks:

```bash
npm run test:sdk              # Run all
npx vitest run assert.test.mjs # Run one
npm run test:sdk:ui           # Interactive UI
```

## Lifecycle Hooks

Tests automatically run:

**Before (prerun):**
- Start dashcam tracking
- Launch Chrome
- Wait for login page

**After (postrun):**
- Stop and upload dashcam

Disable if needed:
```javascript
await setupTest(client, { prerun: false });
await teardownTest(client, { postrun: false });
```

## Available NPM Scripts

```bash
npm run test:sdk           # Run all tests once
npm run test:sdk:watch     # Watch mode
npm run test:sdk:ui        # Interactive UI
npm run test:sdk:coverage  # With coverage report
```

## Common Commands

```bash
# List all test files
ls testdriver/acceptance-sdk/*.test.mjs

# Run specific test with pattern
npx vitest run -t "should assert"

# Run with verbose output
VERBOSE=true npm run test:sdk

# Run with debug events
DEBUG_EVENTS=true npm run test:sdk

# Run with all logging
VERBOSE=true DEBUG_EVENTS=true npm run test:sdk
```

# Generate coverage report
npm run test:sdk:coverage
open coverage/index.html
```

## Test Pattern

```javascript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestClient, setupTest, teardownTest } from './setup/testHelpers.mjs';

describe('Test Name', () => {
  let client;

  beforeAll(async () => {
    client = createTestClient();
    await setupTest(client);  // Auth + connect + prerun
  });

  afterAll(async () => {
    await teardownTest(client);  // Postrun + disconnect
  });

  it('should do something', async () => {
    await client.hoverText('Button', null, 'click');
    const result = await client.assert('expected state');
    expect(result).toBeTruthy();
  });
});
```

## Helpful Utilities

```javascript
// Reusable login
import { performLogin } from './setup/testHelpers.mjs';
await performLogin(client, 'username', 'password');

// Conditional execution (if-else)
import { conditionalExec } from './setup/testHelpers.mjs';
await conditionalExec(
  client,
  'cookie banner exists',
  async () => { /* then */ },
  async () => { /* else */ }
);

// Retry logic
import { retryAsync } from './setup/testHelpers.mjs';
await retryAsync(async () => {
  await client.waitForText('Loading');
}, 3, 1000);
```

## Documentation

- **README.md** - SDK conversion guide and method mapping
- **LOGGING.md** - Complete logging and debugging guide
- **QUICKSTART.md** - This file
- **FIXED.md** - ES module setup notes

## Troubleshooting

**"TD_API_KEY not set"**
```bash
export TD_API_KEY=your_key
echo $TD_API_KEY  # verify
```

**Tests timeout**
```javascript
// Increase in vitest.config.mjs
testTimeout: 300000  // 5 minutes
```

**Need to see logs**
```bash
# Enable basic logging
VERBOSE=true npm run test:sdk

# Enable debug events
DEBUG_EVENTS=true npm run test:sdk

# See LOGGING.md for complete guide
```

## Next Steps

1. Run the example tests to see them work
2. Pick a standalone script and run it
3. Look at a `.test.js` file to understand the pattern
4. Convert more YAML tests if needed

Happy testing! 🚀
