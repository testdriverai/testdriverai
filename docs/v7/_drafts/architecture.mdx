# TestDriver Test Recording Architecture

## Overview

This system provides comprehensive test execution tracking, linking test runs with dashcam screen recordings and CI/CD pipelines in the TestDriver dashboard.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Developer's Machine / CI                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │   Vitest     │────────▶│  TD Vitest   │                  │
│  │  Test Runner │         │   Plugin     │                  │
│  └──────────────┘         └──────┬───────┘                  │
│                                   │                           │
│  ┌──────────────┐                 │                          │
│  │   Dashcam    │                 │                          │
│  │  Recording   │                 │                          │
│  └──────┬───────┘                 │                          │
│         │                         │                           │
│         │ (records screen)        │ (reports results)        │
│         │                         │                           │
└─────────┼─────────────────────────┼───────────────────────────┘
          │                         │
          │                         │
          ▼                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   TestDriver API Server                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │ Replay API   │         │ Test Run API │                  │
│  │ (dashcam)    │         │ (new)        │                  │
│  └──────┬───────┘         └──────┬───────┘                  │
│         │                        │                           │
│         └────────┬───────────────┘                           │
│                  │                                            │
│                  ▼                                            │
│         ┌────────────────┐                                   │
│         │   MongoDB      │                                   │
│         │                │                                   │
│         │ • TdTestRun    │                                   │
│         │ • TdTestCase   │                                   │
│         │ • TdSandbox    │                                   │
│         │ • Replay       │                                   │
│         └────────────────┘                                   │
│                                                               │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  TestDriver Web Dashboard                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────┐                │
│  │        Test Runs View (NEW)             │                │
│  │                                          │                │
│  │  • List all test runs                   │                │
│  │  • Filter by status, date, CI           │                │
│  │  • Show pass/fail statistics            │                │
│  │  • Link to CI/CD runs                   │                │
│  └─────────────────────────────────────────┘                │
│                                                               │
│  ┌─────────────────────────────────────────┐                │
│  │      Test Run Detail View (NEW)         │                │
│  │                                          │                │
│  │  • Test case list with status           │                │
│  │  • Dashcam replay player (embedded)     │                │
│  │  • Error messages and stack traces      │                │
│  │  • Sandbox details                      │                │
│  │  • Git commit info                      │                │
│  └─────────────────────────────────────────┘                │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Data Models

### TdTestRun
Represents a complete test suite execution (e.g., `npx vitest run`).

**Key Fields:**
- `runId`: Unique identifier
- `suiteName`: Name of the test suite
- `status`: running | passed | failed | cancelled
- `totalTests`, `passedTests`, `failedTests`: Statistics
- `platform`: windows | mac | linux
- CI/CD metadata (provider, runId, url)
- Git metadata (repo, branch, commit)
- `dashcamSessionId`: Links to dashcam recordings

**Relationships:**
- `team`: Owner team
- `sandbox`: TdSandbox where tests ran
- `testCases`: Collection of TdTestCase
- `replays`: Associated Replay records

### TdTestCase
Represents an individual test within a test run.

**Key Fields:**
- `testName`: Test name from `test('...')`
- `testFile`: Path to test file
- `suiteName`: Describe block name
- `status`: passed | failed | skipped | pending
- `duration`: Test duration in ms
- `errorMessage`, `errorStack`: Failure details
- `replayUrl`: Direct link to dashcam replay
- `replayStartTime`, `replayEndTime`: Timestamps within replay

**Relationships:**
- `testRun`: Parent TdTestRun
- `replay`: Associated Replay record

### TdSandbox
Represents a spawned VM/sandbox instance.

**Key Fields:**
- `sandboxId`: Unique identifier
- `platform`: windows | mac | linux
- `status`: provisioning | ready | running | stopped | terminated
- `instanceId`, `instanceType`: AWS EC2 details
- `ipAddress`, `vncUrl`, `wsUrl`: Connection details
- `spawnTime`, `readyTime`, `terminateTime`: Lifecycle timestamps
- `dashcamAuth`: Whether dashcam was authenticated
- `dashcamProjectId`: Dashcam project for replays

**Relationships:**
- `team`: Owner team
- `user`: User who spawned it
- `testRuns`: Tests that ran on this sandbox
- `replays`: Dashcam recordings from this sandbox

**Note:** Sandbox creation/updates happen via WebSocket (not REST API) as part of the sandbox provisioning flow.

### Replay (Extended)
Existing model extended with test run associations.

**New Fields:**
- `tdTestRun`: Associated test run
- `tdTestCase`: Associated test case
- `tdSandbox`: Sandbox where recorded

## API Endpoints

### POST /api/v1/testdriver/test-run-create
Create a new test run.

**Auth:** Required (Bearer token)

**Request:**
```json
{
  "runId": "vitest-1234567890-abc123",
  "suiteName": "Integration Tests",
  "platform": "windows",
  "sandboxId": "sandbox-xyz",
  "ciProvider": "GitHub Actions",
  "ciRunId": "12345",
  "repo": "myorg/myrepo",
  "branch": "main",
  "commit": "abc123def456"
}
```

**Response:**
```json
{
  "data": {
    "id": "...",
    "runId": "vitest-1234567890-abc123",
    "status": "running",
    "startTime": 1700000000000
  }
}
```

### POST /api/v1/testdriver/test-run-complete
Mark a test run as complete.

**Auth:** Required

**Request:**
```json
{
  "runId": "vitest-1234567890-abc123",
  "status": "passed",
  "totalTests": 25,
  "passedTests": 24,
  "failedTests": 1,
  "skippedTests": 0
}
```

### POST /api/v1/testdriver/test-case-create
Record a test case result (create or update).

**Auth:** Required

**Request:**
```json
{
  "runId": "vitest-1234567890-abc123",
  "testName": "should login successfully",
  "testFile": "tests/auth/login.test.js",
  "suiteName": "Authentication Tests",
  "status": "passed",
  "startTime": 1700000001000,
  "endTime": 1700000002500,
  "duration": 1500,
  "replayUrl": "https://app.dashcam.io/replay/abc123"
}
```

## Components

### Vitest Plugin (`interfaces/vitest-plugin.mjs`)
Automatically integrates with Vitest test runs.

**Features:**
- Auto-detects CI/CD environment (GitHub Actions, GitLab, etc.)
- Extracts Git metadata from environment or git commands
- Creates test run at start
- Records each test case result
- Associates with dashcam session if `DASHCAM_SESSION_ID` is set
- Completes test run with statistics
- Uses plugin architecture for better global state management

**Usage:**
```javascript
// vitest.config.mjs
import testDriverPlugin from './interfaces/vitest-plugin.mjs';

export default {
  plugins: [
    testDriverPlugin({
      apiKey: process.env.TD_API_KEY,
      apiRoot: process.env.TD_API_ROOT || 'https://testdriver-api.onrender.com',
    }),
  ],
}
```

### SDK Methods (`sdk.js`)

#### `client.createTestRun(options)`
Create a test run programmatically.

#### `client.recordTestCase(options)`
Record a test case result.

#### `client.completeTestRun(options)`
Mark test run as complete.

## Integration Flows

### Flow 1: Automated with Vitest Reporter

```
1. Developer runs: npx vitest run
2. Vitest starts, reporter initializes
3. Reporter creates TdTestRun
4. For each test:
   - Vitest runs test
   - Reporter records TdTestCase (passed/failed)
5. All tests complete
6. Reporter calls completeTestRun()
7. Results visible in dashboard
```

### Flow 2: With Dashcam Recording

```
1. Start dashcam: dashcam start
2. Set session ID: export DASHCAM_SESSION_ID=$(dashcam session-id)
3. Run tests: npx vitest run
4. Reporter creates test run with dashcamSessionId
5. Tests execute, dashcam records
6. Stop dashcam: dashcam stop
7. Publish: dashcam publish -p PROJECT_ID
8. Replay URL returned
9. Dashboard shows test results + replay link
```

### Flow 3: CI/CD Pipeline (GitHub Actions)

```yaml
jobs:
  test:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - name: Start Dashcam
        run: |
          dashcam start
          echo "DASHCAM_SESSION_ID=$(dashcam session-id)" >> $GITHUB_ENV
      - name: Run Tests
        env:
          TD_API_KEY: ${{ secrets.TD_API_KEY }}
        run: npx vitest run
      - name: Publish Recording
        if: always()
        run: |
          dashcam stop
          dashcam publish -p ${{ secrets.DASHCAM_PROJECT_ID }}
```

Reporter auto-detects:
- GitHub repo, branch, commit
- Workflow run ID and URL
- Job ID
- Actor (who triggered)

## Dashcam Association Strategies

### Strategy 1: Session ID (Implemented)
- Set `DASHCAM_SESSION_ID` environment variable
- Reporter includes in test run creation
- Dashboard queries replays by session ID
- Shows all replays from that session

### Strategy 2: Explicit URL (Implemented)
- Dashcam publishes, returns URL
- Pass URL to `recordTestCase()`
- Direct 1:1 link between test and replay

### Strategy 3: Timestamp Matching (Future)
- Parse dashcam logs for replay timestamps
- Match test start/end times with replay markers
- Automatically associate without manual linking
- Allows seeking to exact test within long replay

### Strategy 4: Log Parsing (Future)
- Dashcam logs test names/files during recording
- Parse logs to extract test-to-timestamp mapping
- Generate replay URLs with timestamp seek parameters
- Example: `https://app.dashcam.io/replay/abc123?t=45000` (seek to 45s)

## Dashboard Views (To Be Built)

### Test Runs List
- Table of all test runs
- Columns: Suite Name, Status, Tests (passed/failed), Duration, Date, CI Link
- Filters: Status, Date range, CI provider, Platform
- Search: By suite name, repo, branch

### Test Run Detail
- Header: Suite name, status, duration, platform
- Statistics card: Total/passed/failed/skipped
- Test cases table: Name, Status, Duration, Replay link
- Sidebar: Git info, CI info, Sandbox details
- Dashcam replay player (embedded iframe)
- Click test case → seek replay to that test's time range

### Sandbox Management
- List of active/terminated sandboxes
- Lifecycle timeline visualization
- Cost tracking (duration × instance type)
- Associated test runs

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TD_API_KEY` | Yes | TestDriver API key for authentication |
| `DASHCAM_SESSION_ID` | No | Links test run to dashcam session |
| `TD_SANDBOX_ID` | No | Sandbox ID if running in TestDriver sandbox |
| `GITHUB_ACTIONS` | Auto | Detected for GitHub Actions integration |
| `GITLAB_CI` | Auto | Detected for GitLab CI integration |
| `CIRCLECI` | Auto | Detected for CircleCI integration |

## Future Enhancements

1. **Real-time Test Streaming**
   - WebSocket connection from reporter
   - Live test progress in dashboard
   - See tests pass/fail as they run

2. **Flaky Test Detection**
   - Track test history across runs
   - Identify tests that intermittently fail
   - Suggest fixes based on error patterns

3. **Performance Regression Detection**
   - Compare test durations across runs
   - Alert on significant slowdowns
   - Visualize performance trends

4. **Advanced Dashcam Integration**
   - Automatic timestamp extraction from logs
   - AI-powered test failure analysis from replays
   - Highlight exact moment of failure in replay

5. **Multi-Framework Support**
   - Jest reporter
   - Mocha reporter
   - Playwright reporter
   - Cypress plugin

6. **Cost Analytics**
   - Track sandbox costs per test run
   - Optimize instance types
   - Budget alerts

## Security Considerations

- API keys stored securely (environment variables)
- Bearer token authentication for all API calls
- Team-based access control (tests only visible to team members)
- Replay access control (dashcam's existing permissions)
- No sensitive data in test metadata (sanitize error messages)

## Performance Considerations

- Async test case recording (doesn't slow tests)
- Batch updates for large test suites
- Efficient database indexing (runId, testFile, status)
- Replay association is lazy (doesn't block test recording)
- Optional reporter (disable in local development)
