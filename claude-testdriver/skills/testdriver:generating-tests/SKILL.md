---
name: testdriver:generating-tests
description: Use AI coding agents to generate TestDriver tests via MCP tools
---

## Generating Tests with MCP Tools

Use TestDriver MCP tools for interactive test development with visual feedback:

### Workflow

1. **Start session**: `session_start({ type: "chrome", url: "https://your-app.com" })`
2. **Interact**: Use `find`, `click`, `type` - each returns a screenshot showing the result
3. **Assert**: Use `assert` to verify expected state
4. **Commit**: Use `commit` to auto-generate the test file from recorded commands
5. **Verify**: Use `verify` to run the test from scratch

### Advantages

- **Inline screenshots** after every action - see exactly what the AI sees
- **Automatic code generation** from successful commands
- **O(1) iteration time** - no re-running the entire test for each change

### Example Prompt

```md
Make me a TestDriver test that does the following steps:

Navigate to practicetestautomation.com
Type username student into Username field
Type password Password123 into Password field
Push Submit button
Verify new page contains expected text 'logged in'
```

The agent will:
1. Use `session_start` to open the URL
2. Use `find_and_click` and `type` for each field
3. Use `assert` to verify the login
4. Use `commit` to generate the test file

See `testdriver:mcp-workflow` skill for detailed tool documentation.

## AI Exploration Mode

Within generated tests, the `ai()` method lets TestDriver autonomously figure out how to accomplish a task. It's useful for dynamic or unpredictable UIs where explicit actions may be difficult to define.

```javascript
// Handle dynamic or unpredictable UI
await testdriver.ai('dismiss any popups or modals that appear');
```

<Info>Explicit commands are preferred for production tests, as they are cheaper, faster, and more reliable.</Info>
