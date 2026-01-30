---
name: testdriver:waiting-for-elements
description: Handle async operations and prevent flaky tests
---
<!-- Generated from waiting-for-elements.mdx. DO NOT EDIT. -->

## Waiting for Elements

Use the `timeout` option with `find()` to wait for elements that appear after async operations:

```javascript
// Wait up to 30 seconds for element to appear (polls every 5 seconds)
const element = await testdriver.find('Loading complete indicator', { timeout: 30000 });
await element.click();

// Useful after actions that trigger loading states
await testdriver.find('submit button').click();
await testdriver.find('success message', { timeout: 15000 });

// Short timeout for quick checks
const toast = await testdriver.find('notification toast', { timeout: 5000 });
```

## Flake Prevention

TestDriver automatically waits for the screen and network to stabilize after each action using **redraw detection**. This prevents flaky tests caused by animations, loading states, or dynamic content updates.

<Note>
  Redraw detection adds a small delay after each action but significantly reduces test flakiness.
</Note>

For example, when clicking a submit button that navigates to a new page:

```javascript
// Click submit - TestDriver automatically waits for the new page to load
await testdriver.find('submit button').click();

// By the time this runs, the page has fully loaded and stabilized
await testdriver.assert('dashboard is displayed');
await testdriver.find('welcome message');
```

Without redraw detection, you'd need manual waits or retries to handle the page transition. TestDriver handles this automatically by detecting when the screen stops changing and network requests complete.

You can disable redraw detection or customize its behavior:

```javascript
// Disable redraw detection for faster tests (less reliable)
const testdriver = TestDriver(context, { 
  redraw: false 
});
```

Here is an example of customizing redraw detection:

```javascript
// Fine-tune redraw detection
const testdriver = TestDriver(context, { 
  redraw: {
    enabled: true,
    diffThreshold: 0.1,      // Pixel difference threshold (0-1)
    screenRedraw: true,      // Monitor screen changes
    networkMonitor: true,    // Wait for network idle
  }
});
```
