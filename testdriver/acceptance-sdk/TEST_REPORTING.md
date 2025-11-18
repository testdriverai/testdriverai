# TestDriver SDK Test Reporting

This guide explains the enhanced test reporting system for the TestDriver SDK acceptance tests.

## Overview

The SDK tests use **Vitest** with multiple reporters to provide comprehensive test feedback:

1. **Console Output** - Verbose, detailed logs during test execution
2. **JUnit XML** - For CI/CD integration and third-party tools
3. **JSON Results** - Machine-readable format for custom reporting
4. **HTML Report** - Interactive browser-based test results viewer
5. **GitHub Summary** - Markdown tables in GitHub Actions workflow summaries

## Running Tests Locally

### Basic Test Run
```bash
npm run test:sdk
```
This runs all SDK acceptance tests with verbose output.

### Watch Mode (for development)
```bash
npm run test:sdk:watch
```
Re-runs tests automatically when files change.

### Interactive UI
```bash
npm run test:sdk:ui
```
Opens Vitest's web UI for interactive test exploration.

### View Results After Running Tests

After running tests, you have several options to view results:

#### Terminal Summary
```bash
npm run test:sdk:results
```
Displays a formatted summary in your terminal with:
- ✅ Passed test count
- ❌ Failed test count and error details
- ⏱️ Test duration
- 📁 File-by-file breakdown

#### HTML Report (Best for detailed analysis)
```bash
npm run test:sdk:report
```
Opens the interactive HTML report in your browser showing:
- Detailed test execution timeline
- File-by-file results
- Error stack traces with code context
- Test duration metrics

Or manually open: `test-results/index.html`

## GitHub Actions Reporting

When tests run in GitHub Actions, you get enhanced reporting automatically:

### 📊 GitHub Step Summary

The workflow generates a comprehensive summary visible in the Actions run:

- **Overview Table**: Pass/fail counts, duration, and totals
- **Failed Tests Section**: Each failure with error messages and stack traces
- **Passed Tests Section**: List of all passing tests organized by file

To view: Go to the Actions tab → Select your workflow run → Check the "Summary" section

### 🧪 Test Summary Action

The `test-summary/action` provides:
- Test count badges
- Duration metrics
- Failure annotations in the Files Changed tab

### 📦 Test Artifacts

All test results are uploaded as artifacts (retained for 7 days):
- `junit.xml` - JUnit format for third-party tools
- `results.json` - Machine-readable JSON
- `index.html` - Interactive HTML report (download and open locally)

To download artifacts:
1. Go to the workflow run
2. Scroll to "Artifacts" section at the bottom
3. Download `test-results.zip`

## Test Output Files

All test results are saved to the `test-results/` directory:

```
test-results/
├── junit.xml       # JUnit XML format
├── results.json    # Detailed JSON results
└── index.html      # Interactive HTML report
```

Add this to your `.gitignore`:
```
test-results/
```

## Reporters Explained

### 1. Verbose Reporter (Console)
- Shows full test logs in real-time
- Includes console.log output from tests
- Color-coded pass/fail indicators
- Stack traces for failures

### 2. JUnit Reporter
- Industry-standard XML format
- Compatible with Jenkins, Azure DevOps, etc.
- Used by `test-summary/action`

### 3. JSON Reporter
- Complete test results in JSON format
- Programmatically parseable
- Used by the custom results viewer script

### 4. HTML Reporter
- Interactive web-based viewer
- Visual timeline of test execution
- Filterable and searchable results
- Best for debugging failures locally

## Customizing Test Output

### Run a Single Test File
```bash
npx vitest run testdriver/acceptance-sdk/assert.test.mjs
```

### Enable Even More Verbose Logging
```bash
VERBOSE=true LOGGING=true npm run test:sdk
```

### Change Parallelism
Edit `vitest.config.mjs`:
```javascript
maxForks: 5, // Run 5 tests in parallel instead of 10
```

## Troubleshooting

### "No test results found" error
Make sure you've run the tests first:
```bash
npm run test:sdk
```

### HTML report won't open
Manually navigate to and open `test-results/index.html` in your browser.

### Tests timeout
Increase timeout in `vitest.config.mjs`:
```javascript
testTimeout: 900000, // 15 minutes
```

## Best Practices

1. **Use `test:sdk:results`** for quick terminal summaries
2. **Use `test:sdk:report`** for deep debugging of failures
3. **Check GitHub Summary** in PR reviews for test status
4. **Download artifacts** from GitHub Actions for historical analysis
5. **Run `test:sdk:watch`** during development for fast feedback

## Example GitHub Summary Output

```markdown
# 🧪 TestDriver SDK Test Results

## 📊 Overview
| Metric | Count |
|--------|-------|
| ✅ Passed | 18 |
| ❌ Failed | 2 |
| ⏭️ Skipped | 0 |
| 📝 Total | 20 |
| ⏱️ Duration | 145.23s |

## ❌ Failed Tests

### Assert Test > should assert the testdriver login page shows
**File:** `testdriver/acceptance-sdk/assert.test.mjs`

**Error:**
```
AssertionError: expected false to be truthy
```

## ✅ Passed Tests

### type.test.mjs
- ✅ should type text into input field
- ✅ should clear and retype text

### scroll.test.mjs
- ✅ should scroll down the page
- ✅ should scroll to specific element
```

This summary appears automatically in every GitHub Actions workflow run!
