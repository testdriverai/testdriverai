# TestDriver MCP Server - AI Agent Guidelines

## Essential Workflow

1. **Always connect first**: Call `testdriver_connect` before any other operations
2. **Verify with screenshots**: Screenshots are automatically captured after actions - review them to confirm success
3. **Wait before interacting**: Use `waitForText` or `waitForImage` before clicking/typing to ensure elements are ready
4. **Assert expectations**: After critical actions, use `assert` to verify the expected outcome
5. **Share debugger URL**: After connecting, share the debugger URL with users so they can watch in real-time

## Common Patterns

### Login Flow

```
1. connect() - start sandbox
2. getScreenshot() - see initial state
3. hoverText("Username") - click username field
4. type("user@example.com") - enter username
5. hoverText("Password") - click password field
6. type("password123") - enter password
7. hoverText("Login") - click login button
8. waitForText("Welcome") - wait for success
9. assert("the user is logged in") - verify outcome
10. getScreenshot() - capture final state
```

### Form Testing

```
1. Always wait for form elements before interacting
2. Take screenshots before and after form submission
3. Assert success/error messages appear
4. Use remember() to capture dynamic values (order IDs, timestamps, etc.)
```

## Best Practices

- **Be patient**: Always wait for elements before clicking
- **Be specific**: Use descriptive text in hoverText/assert (e.g., "the blue Submit button" not just "Submit")
- **Verify everything**: Check screenshots to ensure actions succeeded
- **Handle errors**: If an action fails, take a screenshot to diagnose
- **Save tests**: Use `createTestFromActions` to save successful workflows

## Common Mistakes to Avoid

❌ Don't click elements that may not have loaded yet
✅ Do use `waitForText` first

❌ Don't assume actions succeeded without verification
✅ Do check screenshots and use assertions

❌ Don't chain many actions without pauses
✅ Do add small waits between rapid actions

❌ Don't forget to share the debugger URL
✅ Do tell users where to watch the live VM screen
