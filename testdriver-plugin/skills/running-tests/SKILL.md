---
name: running-tests
description: Run TestDriver tests. Use when executing tests with vitest, debugging test failures, or understanding test output.
---

# Running Tests

Read: `node_modules/testdriverai/docs/v7/running-tests.mdx`

## Basic Commands

```bash
# Run all tests
npx vitest run

# Run specific test file
npx vitest run tests/login.test.mjs

# Run tests matching pattern
npx vitest run tests/*.test.mjs

# Watch mode (re-runs on file changes)
npx vitest
```

## Environment Variables

```bash
# Required
TD_API_KEY=your_api_key

# Optional: Run on Windows instead of Linux
TD_OS=windows

# Optional: AWS config for self-hosted Windows
AWS_REGION=us-east-2
AMI_ID=ami-xxxxx
AWS_LAUNCH_TEMPLATE_ID=lt-xxxxx
```

## Running with Options

```bash
# Run specific test with Windows sandbox
TD_OS=windows npx vitest run tests/example.test.mjs

# Run with increased verbosity
npx vitest run --reporter=verbose tests/example.test.mjs
```

## Test Output

TestDriver generates:
- **Console output**: Real-time test progress
- **JUnit XML**: `test-report.junit.xml` for CI integration
- **TestDriver dashboard**: View recordings at [console.testdriver.ai](https://console.testdriver.ai)

## Debugging Failures

1. **Check the recording** - View visual replay on TestDriver dashboard
2. **Log element info**:
   ```javascript
   const el = await testdriver.find("button");
   console.log("Found:", el.found(), el.confidence, el.text);
   ```
3. **Use the two-file workflow** - Iterate quickly with `reconnect: true`

## Two-File Workflow Reminder

For development iteration:
```bash
# Step 1: Run setup
npx vitest run tests/setup.test.mjs

# Step 2: Within 2 minutes, run experiment
npx vitest run tests/experiment.test.mjs
```
