---
name: testdriver:wait
description: Pause the execution of the script for a specified duration.
---
<!-- Generated from wait.mdx. DO NOT EDIT. -->

## Description

The `wait` method stops the test for a number of milliseconds. Then it continues. Use this to add delays between actions, to wait for animations to complete, or to let state changes become stable.

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

- **Use it for simple delays** — to wait for animations, transitions, or state changes after an action.
- **Do not use it to wait for an element** — if you wait for a specific element to show, use `find()` with a `timeout` option:
  ```javascript
  // ✅ Better for waiting for elements
  const element = await testdriver.find('success message', { timeout: 30000 });

  // ❌ Don't do this for element waiting
  await testdriver.wait(5000);
  const element = await testdriver.find('success message');
  ```
- Do not use very long timeouts. This keeps the tests efficient.
- Use it only when necessary. The TestDriver [redraw detection](/performing-actions#waiting-for-dynamic-content) waits automatically for the screen and the network to become stable after each action.
