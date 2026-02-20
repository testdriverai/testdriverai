---
name: testdriver:running-tests
description: Run TestDriver tests with Vitest test runner
---
<!-- Generated from running-tests.mdx. DO NOT EDIT. -->

Learn how to run TestDriver tests efficiently with Vitest's powerful test runner.

## Running Tests

TestDriver works with Vitest's powerful test runner.

<Info>
  Install Vitest globally for best results: `npm install vitest -g`
</Info>

### Run All Tests

```bash
vitest run
```

Executes all test files in your project once and exits. Vitest automatically discovers files matching patterns like `*.test.js`, `*.test.mjs`, or `*.spec.js`.

### Run with Coverage

```bash
vitest run --coverage
```

Generates a code coverage report showing which lines of your source code were executed during tests. Coverage helps identify untested code paths. Results are displayed in the terminal and saved to a `coverage/` directory.

<Info>
  Coverage requires the `@vitest/coverage-v8` package. Install it with `npm install -D @vitest/coverage-v8`.
</Info>

### Run Specific Tests

```bash
vitest run login.test.js
```

Runs only the specified test file. Useful when debugging a single test or working on a specific feature.

```bash
vitest run login.test.js checkout.test.js
```

Runs multiple specific test files. List as many files as needed, separated by spaces.

### Filter Tests by Name

```bash
vitest run --grep "login"
```

The `--grep` flag filters tests by their name (the string passed to `it()` or `test()`). Only tests whose names match the pattern will run. Supports regex patterns for complex matching.

### Run Tests in a Folder

```bash
vitest run tests/e2e/
```

Runs all test files within a specific directory. Great for organizing tests by type (unit, integration, e2e) and running them separately.

## Parallel Execution

TestDriver runs each test in its own cloud sandbox, enabling true parallel execution. Run your entire test suite in minutes instead of hours.

### Control Concurrency

```bash
vitest run --maxConcurrency=5
```

The `--maxConcurrency` flag limits how many tests run simultaneously. This should match your TestDriver license slots to avoid failures from exhausted slots.

### Thread Configuration

```bash
vitest run --pool=threads --minThreads=2 --maxThreads=8
```

Fine-tune thread allocation for optimal performance:
- `--pool=threads` — Uses worker threads for test isolation
- `--minThreads` — Minimum number of threads to keep alive (reduces startup overhead)
- `--maxThreads` — Maximum threads to spawn (limits resource usage)

### License Slots

Your TestDriver plan includes a set number of **license slots** that determine how many tests can run simultaneously. Each running test occupies one slot—when the test completes and the sandbox is destroyed, the slot is immediately available for the next test.

<Info>
  View your available slots at [console.testdriver.ai](https://console.testdriver.ai). Upgrade anytime to increase parallelization.
</Info>

### Configuring Concurrency

Set `maxConcurrency` in your Vitest config to match your license slot limit:

```javascript vitest.config.mjs
import { defineConfig } from 'vitest/config';
import { TestDriver } from 'testdriverai/vitest';

export default defineConfig({
  test: {
    testTimeout: 900000,
    hookTimeout: 900000,
    maxConcurrency: 5, // Match your license slot limit
    reporters: ['default', TestDriver()],
    setupFiles: ['testdriverai/vitest/setup'],
  },
});
```

<Warning>
  Setting `maxConcurrency` higher than your license slots will cause tests to fail when slots are exhausted. Always match this value to your plan's limit.
</Warning>

### Why Parallelization Matters

| Test Suite | Sequential (1 slot) | Parallel (5 slots) | Parallel (10 slots) |
|------------|--------------------|--------------------|---------------------|
| 10 tests @ 2min each | 20 min | 4 min | 2 min |
| 50 tests @ 2min each | 100 min | 20 min | 10 min |
| 100 tests @ 2min each | 200 min | 40 min | 20 min |

<Tip>
  **Pro tip:** Upgrading your plan doesn't just increase speed—it enables faster CI/CD feedback loops, letting your team ship with confidence.
</Tip>

<Card
  title="View Plans & Pricing"
  icon="credit-card"
  href="/v7/cloud"
>
  Compare plans and find the right level of parallelization for your team.
</Card>

## Vitest UI

Use Vitest UI for interactive debugging:

```bash
vitest --ui
```

The `--ui` flag launches a web-based interface for managing your test suite. Unlike `vitest run`, this starts in watch mode by default.

Open http://localhost:51204 to see:
- **Test file tree** — Browse and navigate your test structure
- **Test status and duration** — See pass/fail states and timing at a glance
- **Console output** — View logs and errors inline with each test
- **Re-run individual tests** — Click to re-execute specific tests without restarting
- **Filter and search** — Quickly find tests by name or status

<Tip>
  Combine with `--open` to automatically open the UI in your browser: `vitest --ui --open`
</Tip>


## Test Reports

After running tests, view detailed reports and video replays at [console.testdriver.ai](https://console.testdriver.ai).

Reports include:
- **Video replays** - Watch exactly what happened during each test
- **Screenshots** - See the state at each step
- **Timing breakdown** - Identify slow operations
- **Error details** - Debug failures with full context

```bash
$ vitest run

 ✓ login.test.js (2) 18.4s
   ✓ user can login 12.3s
   ✓ shows error for invalid credentials 6.1s

📹 View reports at: https://console.testdriver.ai
```

<Tip>
  Bookmark your team's dashboard at [console.testdriver.ai](https://console.testdriver.ai) for quick access to test history and analytics.
</Tip>
