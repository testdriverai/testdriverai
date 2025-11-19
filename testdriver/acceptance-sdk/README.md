# TestDriver SDK Acceptance Tests

This directory contains acceptance tests for the TestDriver SDK using Vitest.

## Running Tests

### Run All Tests (Cross-Platform)

```bash
npm run test:sdk
```

### Run Platform-Specific Tests

Use the `TEST_PLATFORM` environment variable to run tests for a specific platform:

```bash
# Run Windows-only tests
npm run test:sdk:windows

# Run macOS-only tests
npm run test:sdk:mac

# Run Linux-only tests
npm run test:sdk:linux
```

Or set the environment variable directly:

```bash
TEST_PLATFORM=windows npm run test:sdk
TEST_PLATFORM=mac npm run test:sdk
```

## Test Organization

### Cross-Platform Tests

Tests without a platform suffix run on all platforms:

- `hover-text.test.mjs` - Runs everywhere
- `scroll.test.mjs` - Runs everywhere
- `screenshot.test.mjs` - Runs everywhere

### Platform-Specific Tests

Platform-specific tests use naming conventions:

- `*.windows.test.mjs` - Windows-only tests (e.g., `exec-pwsh.windows.test.mjs`)
- `*.mac.test.mjs` - macOS-only tests
- `*.linux.test.mjs` - Linux-only tests

### Conditional Test Skipping

Some tests use `skipIf` to conditionally skip based on the platform:

```javascript
it.skipIf(() => testdriver.os === "linux")(
  "should run on Windows/Mac",
  async () => {
    // This test will be skipped on Linux
  },
);
```

## Environment Variables

- `TEST_PLATFORM` - Filter tests by platform (`windows`, `mac`, `linux`)
- `TD_OS` - Override the sandbox OS (defaults to `linux`)
- `TD_API_KEY` - Your TestDriver API key (required)
- `TD_API_ROOT` - API endpoint (optional)
- `DEBUG_ENV` - Show environment variable loading (optional)
- `DEBUG_EVENTS` - Enable detailed event logging (optional)

## Examples

```bash
# Run only Windows tests on a Windows sandbox
TEST_PLATFORM=windows npm run test:sdk

# Run all tests but use a Windows sandbox
TD_OS=windows npm run test:sdk

# Run with debugging enabled
DEBUG_ENV=true DEBUG_EVENTS=true npm run test:sdk

# Watch mode for development
npm run test:sdk:watch

# Generate coverage report
npm run test:sdk:coverage
```

## Test Structure

Each test follows this pattern:

```javascript
import { afterAll, beforeAll, describe, it } from "vitest";
import {
  createTestClient,
  setupTest,
  teardownTest,
} from "./setup/testHelpers.mjs";

describe("My Test", () => {
  let testdriver;

  beforeAll(async () => {
    testdriver = createTestClient();
    await setupTest(testdriver);
  });

  afterAll(async () => {
    await teardownTest(testdriver);
  });

  it("should do something", async () => {
    // Your test logic
  });
});
```

## See Also

- [SDK README](../../SDK_README.md) - Full SDK documentation
- [Quick Reference](./QUICK_REFERENCE.md) - SDK method quick reference
- [Test Reporting](./TEST_REPORTING.md) - Test recording and reporting docs
