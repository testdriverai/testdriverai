---
name: testdriver:debugging-with-screenshots
description: View and analyze saved screenshots using MCP commands for test debugging and development
---
<!-- Generated from debugging-with-screenshots.mdx. DO NOT EDIT. -->

## Overview

TestDriver MCP provides powerful commands to view and analyze screenshots saved during test execution. This enables rapid debugging, test development, and comparison workflows without manually opening image files.

## MCP Commands

### list_local_screenshots

List all screenshots saved in the `.testdriver/screenshots/` directory:

```
list_local_screenshots()
```

**Optional Parameters:**

<ParamField path="directory" type="string" optional>
  Filter screenshots by subdirectory (e.g., specific test file). If omitted, lists all screenshots.
</ParamField>

**Returns:**

Array of screenshot metadata including:
- `path` - Full absolute path to the screenshot file
- `relativePath` - Path relative to `.testdriver/screenshots/`
- `testFile` - The test file that created this screenshot
- `filename` - Screenshot filename
- `size` - File size in bytes
- `modified` - Last modification timestamp
- `created` - Creation timestamp

**Example Response:**

```json
[
  {
    "path": "/Users/user/project/.testdriver/screenshots/login.test/screenshot-1737633600000.png",
    "relativePath": "login.test/screenshot-1737633600000.png",
    "testFile": "login.test",
    "filename": "screenshot-1737633600000.png",
    "size": 145632,
    "modified": "2026-01-23T10:00:00.000Z",
    "created": "2026-01-23T10:00:00.000Z"
  }
]
```

### view_local_screenshot

View a specific screenshot from the list:

```
view_local_screenshot({ path: "/full/path/to/screenshot.png" })
```

**Parameters:**

<ParamField path="path" type="string" required>
  Full absolute path to the screenshot file (as returned by `list_local_screenshots`)
</ParamField>

**Returns:**

- Image content (displayed to both AI and user via MCP App)
- Screenshot metadata
- Success/error status

## Common Workflows

### Test Debugging After Failures

When a test fails, view the saved screenshots to understand what went wrong:

1. **List screenshots from the failed test:**

```
list_local_screenshots({ directory: "login.test" })
```

2. **View screenshots in chronological order** (sorted by creation time) to trace the test execution:

```
view_local_screenshot({ path: ".testdriver/screenshots/login.test/screenshot-1737633600000.png" })
view_local_screenshot({ path: ".testdriver/screenshots/login.test/screenshot-1737633610000.png" })
view_local_screenshot({ path: ".testdriver/screenshots/login.test/screenshot-1737633620000.png" })
```

3. **Analyze the UI state** at each step to identify where things went wrong

4. **Compare expected vs actual** - if you added descriptive filenames with `screenshot("step-name")`, you can easily identify key moments

### Interactive Test Development

While building tests using MCP tools, view screenshots to verify your test logic:

1. **After a test run**, list screenshots to see what was captured:

```
list_local_screenshots()
```

2. **Review key points** in the test execution:

```
view_local_screenshot({ path: ".testdriver/screenshots/my-test.test/after-login.png" })
```

3. **Verify element locations and states** before adding assertions

4. **Iterate** - adjust your test code based on what you see in the screenshots

### Comparison and Analysis

Compare screenshots across multiple test runs to identify flaky behavior or UI changes:

1. **List screenshots from multiple test runs** (note: each test run clears the folder, so copy screenshots elsewhere for comparison if needed)

2. **View screenshots side-by-side** to spot differences:

```
view_local_screenshot({ path: ".testdriver/screenshots/test.test/before-click.png" })
// Analyze first run

view_local_screenshot({ path: ".testdriver/screenshots-backup/test.test/before-click.png" })
// Compare with previous run
```

3. **Identify timing issues** - if element positions or states vary between runs, you may have timing/race condition issues

## Best Practices

<AccordionGroup>
  <Accordion title="Use descriptive filenames">
    When saving screenshots in tests, use descriptive names to make them easier to identify:
    
    ```javascript
    await testdriver.screenshot("initial-page-load");
    await testdriver.screenshot("after-login-click");
    await testdriver.screenshot("dashboard-loaded");
    ```
    
    Then when listing screenshots, you can quickly identify key moments without viewing every image.
  </Accordion>

  <Accordion title="List before viewing">
    Always call `list_local_screenshots` first to see what's available. The list is sorted by modification time (newest first), making it easy to find recent test runs.
  </Accordion>

  <Accordion title="Filter by test file">
    When debugging a specific test, use the `directory` parameter to filter screenshots:
    
    ```
    list_local_screenshots({ directory: "problematic-test.test" })
    ```
    
    This avoids clutter from other tests.
  </Accordion>

  <Accordion title="View screenshots before and after failures">
    When a test fails (especially with assertions), look at screenshots immediately before the failure. They show exactly what the AI or test "saw" at that moment, helping you understand why an assertion failed or why an element wasn't found.
  </Accordion>

  <Accordion title="Combine with test reports">
    TestDriver test reports include screenshots in the timeline. Use MCP screenshot viewing for interactive debugging during development, and test reports for post-run analysis and team sharing.
  </Accordion>

  <Accordion title="Archive important screenshots">
    Remember that each test run clears its screenshot folder. If you need to preserve screenshots for comparison:
    
    ```bash
    # Copy screenshots before next run
    cp -r .testdriver/screenshots/my-test.test .testdriver/screenshots-backup/
    ```
  </Accordion>
</AccordionGroup>

## Screenshot File Organization

Understanding the directory structure helps with efficient screenshot viewing:

```
.testdriver/
  screenshots/
    login.test/              # Test file name (without .mjs extension)
      screenshot-1737633600000.png   # Auto-generated timestamp filename
      initial-state.png              # Custom descriptive filename
      after-click.png
    checkout.test/
      screenshot-1737633700000.png
      product-page.png
    profile.test/
      screenshot-1737633800000.png
```

- Each test file gets its own subdirectory
- Filenames are either timestamps (default) or custom names you provide
- Folders are cleared at the start of each test run
- All screenshots are PNG format

## Integration with Test Development

### During MCP Interactive Development

When using TestDriver MCP tools (`session_start`, `find_and_click`, etc.), screenshots are automatically captured and displayed. Additionally, you can view previously saved screenshots:

```
# After test development session
list_local_screenshots({ directory: "my-new-test.test" })
view_local_screenshot({ path: ".testdriver/screenshots/my-new-test.test/login-page.png" })
```

This helps verify your test logic before running the full test file.

### After Test Runs

When tests fail or behave unexpectedly:

1. **Run the test** with `vitest run tests/my-test.test.mjs`
2. **List screenshots** using `list_local_screenshots`
3. **View relevant screenshots** to diagnose the issue
4. **Update test code** based on what you see
5. **Re-run and verify** the fix

## Troubleshooting

<AccordionGroup>
  <Accordion title="No screenshots found">
    If `list_local_screenshots` returns an empty array:
    
    - Ensure your test includes `await testdriver.screenshot()` calls
    - Verify the test actually ran (check test output)
    - Check that `.testdriver/screenshots/` directory exists
    - Confirm you're in the correct project directory
  </Accordion>

  <Accordion title="Screenshot not displaying">
    If `view_local_screenshot` returns an error:
    
    - Verify the path is exactly as returned by `list_local_screenshots`
    - Check file permissions - ensure the screenshot file is readable
    - Confirm the file hasn't been deleted or moved
  </Accordion>

  <Accordion title="Too many screenshots">
    If you have hundreds of screenshots making it hard to find what you need:
    
    - Use the `directory` parameter to filter by test file
    - Consider adding more descriptive filenames in your tests
    - Clean up old screenshot folders: `rm -rf .testdriver/screenshots/*`
  </Accordion>

  <Accordion title="Screenshots from old test runs">
    Remember that screenshot folders are cleared at the start of each test run. If you see old screenshots:
    
    - The test may not have run recently
    - Or the test failed before reaching the clearing logic
    - Manually clear: `rm -rf .testdriver/screenshots/<test-name>/`
  </Accordion>
</AccordionGroup>

## Related

- [screenshot()](/v7/screenshot) - Capture screenshots during test execution
- [Dashcam](/v7/dashcam) - Record full test sessions with video and logs
- [assert()](/v7/assert) - Make AI-powered assertions that benefit from screenshot context
