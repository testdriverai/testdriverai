# TestDriver Test Recording and Dashboard Integration

This guide explains how to record test runs and associate them with dashcam recordings in the TestDriver dashboard.

## Overview

The TestDriver test recording system tracks:
- **Test Runs**: Complete test suite executions
- **Test Cases**: Individual test results with pass/fail status
- **Sandboxes**: VM instances where tests run
- **Dashcam Recordings**: Screen recordings associated with tests

## Setup

### 1. Install Vitest Reporter

The TestDriver Vitest reporter automatically records your test runs:

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config';
import { TestDriverReporter } from './interfaces/vitest-reporter.js';

export default defineConfig({
  test: {
    reporters: ['default', new TestDriverReporter()],
  },
});
```

### 2. Set Environment Variables

```bash
# Required: TestDriver API Key
export TD_API_KEY="your-api-key"

# Optional: Dashcam session ID for linking recordings
export DASHCAM_SESSION_ID="session-id-from-dashcam"

# Optional: Sandbox ID if running in TestDriver sandbox
export TD_SANDBOX_ID="sandbox-id"
```

### 3. Run Tests

```bash
npx vitest run
```

The reporter will automatically:
- Create a test run record
- Record each test case result
- Link to CI/CD metadata (GitHub Actions, GitLab CI, etc.)
- Associate with dashcam recordings when available

## Dashcam Integration

### Recording Tests with Dashcam

To capture screen recordings of your tests:

1. **Start Dashcam before tests**:
```bash
dashcam start
dashcam track --name="TestDriver" --type=application --pattern="/path/to/logs"
```

2. **Run your tests** (with the Vitest reporter enabled)

3. **Stop Dashcam after tests**:
```bash
dashcam stop
dashcam publish -p PROJECT_ID
```

### Associating Recordings with Tests

The system links dashcam recordings to specific tests by parsing replay URLs from test output.

#### How It Works

1. **Dashcam publishes** and outputs a replay URL like:
   ```
   https://app.dashcam.io/replay/691cf130c2fc02f59ae66fc1
   ```

2. **The reporter parses** test logs/output to find these URLs

3. **The URL contains the Replay DB ID** (e.g., `691cf130c2fc02f59ae66fc1`)

4. **The reporter associates** the test case with that replay

#### Option 1: Automatic from Test Output (Recommended)

If your test logs dashcam URLs, the reporter will automatically detect and link them:

```javascript
test('my test', async () => {
  // Your test code...
  
  // Dashcam CLI outputs this during publish:
  // ✅ Replay URL: https://app.dashcam.io/replay/691cf130c2fc02f59ae66fc1
  
  // Reporter automatically parses and links it!
});
```

#### Option 2: Manual Environment Variable

Set the replay URL manually if needed:

```bash
export DASHCAM_REPLAY_URL="https://app.dashcam.io/replay/691cf130c2fc02f59ae66fc1"
npx vitest run
```

#### Option 3: Explicit SDK Call

Use the SDK to explicitly link a test to a replay:

```javascript
await client.recordTestCase({
  runId: 'your-run-id',
  testName: 'login test',
  testFile: 'tests/login.test.js',
  status: 'passed',
  replayUrl: 'https://app.dashcam.io/replay/691cf130c2fc02f59ae66fc1'
});
```

## CI/CD Integration

### GitHub Actions

The reporter automatically detects GitHub Actions and records:
- Workflow run ID
- Job ID
- Repository
- Branch
- Commit SHA
- Run URL

```yaml
# .github/workflows/test.yml
name: Tests
on: [push]
jobs:
  test:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
      - name: Install dependencies
        run: npm install
      - name: Run tests
        env:
          TD_API_KEY: ${{ secrets.TD_API_KEY }}
        run: npx vitest run
```

### GitLab CI

```yaml
# .gitlab-ci.yml
test:
  script:
    - npm install
    - npx vitest run
  variables:
    TD_API_KEY: $CI_JOB_TOKEN
```

### Other CI Providers

The reporter auto-detects:
- CircleCI
- Travis CI
- Jenkins
- Buildkite

## API Endpoints

The following endpoints are available for custom integrations:

### Create Test Run
```
POST /api/v1/testdriver/test-run-create
```

**Body:**
```json
{
  "runId": "unique-run-id",
  "suiteName": "My Test Suite",
  "platform": "windows",
  "sandboxId": "sandbox-123",
  "ci": {
    "provider": "GitHub Actions",
    "runId": "12345",
    "url": "https://github.com/..."
  },
  "git": {
    "repo": "owner/repo",
    "branch": "main",
    "commit": "abc123"
  }
}
```

### Complete Test Run
```
POST /api/v1/testdriver/test-run-complete
```

**Body:**
```json
{
  "runId": "unique-run-id",
  "status": "passed",
  "totalTests": 10,
  "passedTests": 10,
  "failedTests": 0,
  "skippedTests": 0
}
```

### Record Test Case
```
POST /api/v1/testdriver/test-case-create
```

**Body:**
```json
{
  "runId": "unique-run-id",
  "testName": "should login successfully",
  "testFile": "tests/login.test.js",
  "status": "passed",
  "duration": 1500,
  "replayUrl": "https://app.dashcam.io/replay/abc123",
  "errorMessage": null,
  "errorStack": null
}
```

## SDK Methods

Use these methods in your test code:

### Create Test Run
```javascript
const testRun = await client.createTestRun({
  runId: 'unique-id',
  suiteName: 'My Tests',
  platform: 'windows',
  git: {
    repo: 'myorg/myrepo',
    branch: 'main',
    commit: 'abc123'
  }
});
```

### Record Test Case
```javascript
await client.recordTestCase({
  runId: 'unique-id',
  testName: 'my test',
  testFile: 'tests/my.test.js',
  status: 'passed',
  duration: 1000,
  replayUrl: 'https://app.dashcam.io/replay/xyz'
});
```

### Complete Test Run
```javascript
await client.completeTestRun({
  runId: 'unique-id',
  status: 'passed',
  totalTests: 5,
  passedTests: 5,
  failedTests: 0
});
```

## Viewing Results

Access your test results in the TestDriver dashboard:

1. Navigate to **Dashboard** → **Test Runs**
2. View test run history with:
   - Total/passed/failed test counts
   - Duration and timing
   - CI/CD integration links
   - Associated dashcam recordings
3. Click on individual tests to see:
   - Test details and error messages
   - Linked dashcam replay (if available)
   - Sandbox information
   - Git commit and branch info

## Troubleshooting

### Tests recorded but no dashcam link
- Ensure `DASHCAM_SESSION_ID` is set
- Check that dashcam is running during tests
- Verify dashcam is publishing to the correct project

### Reporter not creating records
- Verify `TD_API_KEY` is set correctly
- Check network connectivity to TestDriver API
- Look for error messages in reporter output

### CI/CD metadata not captured
- Ensure CI environment variables are available
- Check that CI provider is supported
- Manually set git metadata if needed

## Advanced Usage

### Custom Test Metadata

Add custom metadata to tests:

```javascript
test('complex test', async () => {
  await client.recordTestCase({
    runId: process.env.TD_RUN_ID,
    testName: 'complex test',
    testFile: __filename,
    status: 'passed',
    tags: ['smoke', 'critical'],
    steps: [
      { action: 'navigate', target: '/login' },
      { action: 'fill', target: 'username' },
      { action: 'click', target: 'submit' }
    ]
  });
});
```

### Multiple Test Runs

Track parallel test runs:

```javascript
// Worker 1
const run1 = await client.createTestRun({
  runId: 'run-1',
  suiteName: 'Suite A'
});

// Worker 2
const run2 = await client.createTestRun({
  runId: 'run-2',
  suiteName: 'Suite B'
});
```

## Data Models

### TdTestRun
- Test suite execution tracking
- CI/CD and Git metadata
- Summary statistics
- Linked to sandbox and replays

### TdTestCase
- Individual test results
- Error messages and stack traces
- Associated dashcam replay
- Timing and duration

### TdSandbox
- VM/sandbox lifecycle tracking
- Platform and OS information
- Dashcam integration status
- Cost and usage metrics

### Replay
- Dashcam recordings
- Linked to test runs and cases
- Timestamp markers for test boundaries
