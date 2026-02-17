---
name: testdriver:debugging-with-screenshots
description: View and analyze saved screenshots using MCP commands for test debugging and development
---
<!-- Generated from debugging-with-screenshots.mdx. DO NOT EDIT. -->

## Overview

TestDriver MCP provides powerful commands to view and analyze screenshots saved during test execution. This enables rapid debugging, test development, and comparison workflows without manually opening image files.

<Note>
  **Automatic Screenshots (Default: Enabled)**: TestDriver automatically captures screenshots before and after every command. Screenshots are named with the line number and action, making it easy to trace exactly which line of code produced each screenshot. For example: `001-click-before-L42-submit-button.png`
</Note>

## MCP Commands

### list_local_screenshots

List and filter screenshots saved in the `.testdriver/screenshots/` directory:

```
list_local_screenshots()
```

**Filter Parameters:**

<ParamField path="directory" type="string" optional>
  Filter screenshots by test file or subdirectory (e.g., "login.test", "mcp-screenshots"). If omitted, lists all screenshots.
</ParamField>

<ParamField path="line" type="number" optional>
  Filter by exact line number from test file (e.g., 42 matches L42 in filename).
</ParamField>

<ParamField path="lineRange" type="object" optional>
  Filter by line number range. Example: `{ start: 10, end: 20 }` matches screenshots from lines 10-20.
</ParamField>

<ParamField path="action" type="string" optional>
  Filter by action type: `click`, `find`, `type`, `assert`, `provision`, `scroll`, `hover`, etc.
</ParamField>

<ParamField path="phase" type="string" optional>
  Filter by phase: `"before"` (state before action) or `"after"` (state after action).
</ParamField>

<ParamField path="pattern" type="string" optional>
  Regex pattern to match against filename. Example: `"login|signin"` or `"button.*click"`.
</ParamField>

<ParamField path="sequence" type="number" optional>
  Filter by exact sequence number.
</ParamField>

<ParamField path="sequenceRange" type="object" optional>
  Filter by sequence range. Example: `{ start: 1, end: 10 }` matches first 10 screenshots.
</ParamField>

<ParamField path="limit" type="number" optional>
  Maximum number of results to return (default: 50).
</ParamField>

<ParamField path="sortBy" type="string" optional>
  Sort results by: `"modified"` (newest first, default), `"sequence"` (execution order), or `"line"` (line number).
</ParamField>

**Returns:**

Array of screenshot metadata including:
- `path` - Full absolute path to the screenshot file
- `relativePath` - Path relative to `.testdriver/screenshots/`
- `name` - Screenshot filename
- `sizeBytes` - File size in bytes
- `modified` - Last modification timestamp
- `sequence` - Sequential number (from auto-screenshots)
- `action` - Action type (click, find, etc.)
- `phase` - Before/after phase
- `lineNumber` - Line number from test file
- `description` - Element or action description

**Example Responses:**

```json
// Basic listing
[
  {
    "path": "/Users/user/project/.testdriver/screenshots/login.test/001-click-before-L42-submit-button.png",
    "relativePath": "login.test/001-click-before-L42-submit-button.png",
    "name": "001-click-before-L42-submit-button.png",
    "sizeBytes": 145632,
    "modified": "2026-01-23T10:00:00.000Z",
    "sequence": 1,
    "action": "click",
    "phase": "before",
    "lineNumber": 42,
    "description": "submit-button"
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

When a test fails, use powerful filtering to quickly find relevant screenshots:

**1. Find screenshots at the failing line:**

```
// If test failed at line 42
list_local_screenshots({ line: 42 })

// View before and after states at that line
view_local_screenshot({ path: ".testdriver/screenshots/login.test/005-click-before-L42-submit-button.png" })
view_local_screenshot({ path: ".testdriver/screenshots/login.test/006-click-after-L42-submit-button.png" })
```

**2. See what happened leading up to the failure:**

```
// Get screenshots from lines 35-45 to see context
list_local_screenshots({ directory: "login.test", lineRange: { start: 35, end: 45 } })
```

**3. Find all assertion screenshots:**

```
// See what the screen looked like during assertions
list_local_screenshots({ action: "assert" })
```

**4. View the final state before failure:**

```
// Get the last 5 screenshots in execution order
list_local_screenshots({ directory: "login.test", sortBy: "sequence", limit: 5 })
```

### Finding Specific Actions

When debugging element interactions:

```
// Find all click actions
list_local_screenshots({ action: "click" })

// Find what the screen looked like BEFORE each click
list_local_screenshots({ action: "click", phase: "before" })

// Find screenshots related to a specific element using regex
list_local_screenshots({ pattern: "submit|button" })

// Find all type actions (for form filling issues)
list_local_screenshots({ action: "type" })
```

### Understanding Test Flow

View screenshots in execution order to trace test behavior:

```
// Get screenshots in execution order
list_local_screenshots({ directory: "checkout.test", sortBy: "sequence" })

// Get just the first 10 actions
list_local_screenshots({ sequenceRange: { start: 1, end: 10 }, sortBy: "sequence" })

// Get just the last 10 actions
list_local_screenshots({ directory: "checkout.test", sortBy: "sequence", limit: 10 })
```

### Interactive Test Development

While building tests using MCP tools, view screenshots to verify your test logic:

1. **After a test run**, filter screenshots to see specific actions:

```
// See all assertions
list_local_screenshots({ action: "assert" })

// See what happened at a specific line you're debugging
list_local_screenshots({ line: 25 })
```

2. **Review key points** in the test execution:

```
view_local_screenshot({ path: ".testdriver/screenshots/my-test.test/after-login.png" })
```

3. **Verify element locations and states** before adding assertions

4. **Iterate** - adjust your test code based on what you see in the screenshots

### Comparison and Analysis

Compare screenshots to identify issues:

**Using phase filtering for before/after comparison:**

```
// See state before all clicks
list_local_screenshots({ action: "click", phase: "before" })

// See state after all clicks  
list_local_screenshots({ action: "click", phase: "after" })
```

**Using line-based debugging:**

```
// Something went wrong around line 50
list_local_screenshots({ lineRange: { start: 45, end: 55 } })
```

**Using regex patterns:**

```
// Find screenshots related to login functionality
list_local_screenshots({ pattern: "login|signin|email|password" })
```

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
      001-find-before-L15-email-input.png     # Auto: before find() at line 15
      002-find-after-L15-email-input.png      # Auto: after find() at line 15
      003-click-before-L16-email-input.png    # Auto: before click() at line 16
      004-click-after-L16-email-input.png     # Auto: after click() at line 16
      login-complete.png                       # Manual: screenshot("login-complete")
    checkout.test/
      001-find-before-L12-add-to-cart.png
      002-find-after-L12-add-to-cart.png
      ...
```

### Automatic Screenshot Naming Format

`<seq>-<action>-<phase>-L<line>-<description>.png`

| Component | Description | Example |
|-----------|-------------|---------|
| `seq` | Sequential number | `001`, `002` |
| `action` | Command name | `click`, `type`, `find` |
| `phase` | Before, after, or error | `before`, `after`, `error` |
| `L<line>` | Line number from test file | `L42` |
| `description` | Element/action description | `submit-button` |

### Key Points

- Each test file gets its own subdirectory
- Automatic screenshots include line numbers for easy tracing
- Manual `screenshot()` calls use custom names you provide
- Folders are cleared at the start of each test run
- All screenshots are PNG format
- Disable automatic screenshots with `autoScreenshots: false` if needed

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
    If you have hundreds of screenshots making it hard to find what you need, use filtering:
    
    - Filter by test file: `list_local_screenshots({ directory: "my-test.test" })`
    - Filter by line number: `list_local_screenshots({ line: 42 })` or `list_local_screenshots({ lineRange: { start: 40, end: 50 } })`
    - Filter by action: `list_local_screenshots({ action: "click" })`
    - Filter by phase: `list_local_screenshots({ phase: "before" })`
    - Use regex: `list_local_screenshots({ pattern: "submit|login" })`
    - Limit results: `list_local_screenshots({ limit: 10 })`
    - Sort by line: `list_local_screenshots({ sortBy: "line" })`
    - Clean up old folders: `rm -rf .testdriver/screenshots/*`
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
