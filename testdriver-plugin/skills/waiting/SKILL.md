---
name: waiting
description: Wait for elements in TestDriver tests. Use when polling for elements, waiting for page loads, handling loading states, or setting timeouts.
---

# Waiting for Elements

Read: `node_modules/testdriverai/docs/v7/waiting-for-elements.mdx`

## Polling with Timeout

Use the `timeout` option to poll until an element is found:

```javascript
// Retries every 5 seconds until found or timeout
const element = await testdriver.find("Success message", { timeout: 30000 });
```

## Wait for Page Load

```javascript
// Assert something visible after load
await testdriver.assert("Page has finished loading");

// Or check for specific content
await testdriver.assert("Welcome message is visible");
```

## Wait via Assertion

```javascript
// This will wait and retry until true or timeout
const loaded = await testdriver.assert("The dashboard has fully loaded");
expect(loaded).toBeTruthy();
```

## Wait via exec (JavaScript)

```javascript
await testdriver.exec("js", `
  await new Promise(resolve => {
    const check = () => {
      if (document.querySelector('.loaded')) resolve();
      else setTimeout(check, 100);
    };
    check();
  });
`, 10000);
```

## Common Patterns

### Wait for element to disappear
```javascript
// Keep checking until loading spinner is gone
let spinner = await testdriver.find("Loading spinner");
while (spinner.found()) {
  await new Promise(r => setTimeout(r, 1000));
  spinner = await testdriver.find("Loading spinner");
}
```

### Wait between actions
```javascript
await button.click();
await new Promise(r => setTimeout(r, 2000));  // Wait 2 seconds
await testdriver.assert("Result is visible");
```

## Examples

See `node_modules/testdriverai/docs/guide/best-practices-polling.mdx`
