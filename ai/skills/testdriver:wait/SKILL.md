---
name: testdriver:wait
description: Pause the execution of the script for a specified duration.
---
<!-- Generated from wait.mdx. DO NOT EDIT. -->

## Description

The `wait` method pauses test execution for a specified number of milliseconds before continuing. This is useful for adding delays between actions, waiting for animations to complete, or pausing for state changes to settle.

## Syntax

```javascript
await testdriver.wait(timeout);
```

## Arguments

| Argument  | Type     | Default | Description                           |
| --------- | -------- | ------- | ------------------------------------- |
| `timeout` | `number` | `3000`  | The duration in milliseconds to wait. |

## Examples

```javascript
// Wait 2 seconds for an animation to complete
await testdriver.find('submit button').click();
await testdriver.wait(2000);

// Wait 5 seconds
await testdriver.wait(5000);

// Wait with default timeout (3 seconds)
await testdriver.wait();
```

## Best Practices

- **Use for simple delays** — waiting for animations, transitions, or state changes after an action.
- **Avoid for element waiting** — if you're waiting for a specific element to appear, use `find()` with a `timeout` option instead:
  ```javascript
  // ✅ Better for waiting for elements
  const element = await testdriver.find('success message', { timeout: 30000 });

  // ❌ Don't do this for element waiting
  await testdriver.wait(5000);
  const element = await testdriver.find('success message');
  ```
- Avoid excessively long timeouts to keep tests efficient.
- Use sparingly — TestDriver's [redraw detection](/v7/waiting-for-elements) automatically waits for screen and network stability after each action.
