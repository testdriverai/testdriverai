---
name: testdriver:performing-actions
description: Perform actions and handle dynamic, async UI so tests adapt to change
---
<!-- Generated from performing-actions.mdx. DO NOT EDIT. -->

Real apps move, load, and change. Adapt your tests to handle it.

Once you've [generated](/v7/generating-tests) and [learned](/v7/caching) your tests and gotten them [running](/v7/copilot/running-tests), the next challenge is the real world: buttons appear after a spinner, pages navigate, animations play, and content streams in over the network. To keep tests reliable, you need to perform the right actions and handle timing so your tests adapt to how the UI actually behaves instead of breaking.

## Performing Actions

TestDriver provides a variety of actions you can perform, like [clicking](/v7/click), [typing](/v7/type), [hovering](/v7/hover), and [scrolling](/v7/scroll). For a full list, see the [API Reference](/v7/click).

```javascript
// Clicking
await testdriver.find('submit button').click();
await testdriver.find('file item').doubleClick();
await testdriver.find('text area').rightClick();

// Typing
await testdriver.find('email input').type('user@example.com');
await testdriver.find('password input').type('secret', { secret: true });

// Keyboard shortcuts
await testdriver.pressKeys(['enter']);
await testdriver.pressKeys(['ctrl', 'c']);

// Hovering
await testdriver.find('dropdown menu').hover();

// Scrolling
await testdriver.scroll('down', 500);

// Waiting
await testdriver.wait(2000); // Wait 2 seconds for animation/state change

// Extracting information from screen
const price = await testdriver.extract('the total price');
const orderNumber = await testdriver.extract('the order confirmation number');
```

### Chaining Actions

TestDriver supports method chaining for cleaner code:

```javascript
// Chain find() with actions
const button = await testdriver.find('submit button').click();
```

Or save element reference for later use:

```javascript
const button = await testdriver.find('submit button');
await button.click();
```

## Waiting for Dynamic Content

By default, `find()` automatically polls for up to 10 seconds, retrying every 5 seconds until the element is found. This means most elements that appear after short async operations will be found without any extra configuration.

For longer operations, increase the `timeout`:

```javascript
// Default behavior - polls for up to 10 seconds automatically
const element = await testdriver.find('Loading complete indicator');
await element.click();

// Wait up to 30 seconds for slower operations
const element = await testdriver.find('Loading complete indicator', { timeout: 30000 });
await element.click();

// Useful after actions that trigger loading states
await testdriver.find('submit button').click();
await testdriver.find('success message', { timeout: 15000 });

// Disable polling for instant checks
const toast = await testdriver.find('notification toast', { timeout: 0 });
```

### Flake Prevention

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

### Simple Delays with `wait()`

For simple pauses — waiting for animations, transitions, or state changes after an action — use `wait()`:

```javascript
// Wait for an animation to complete
await testdriver.find('menu toggle').click();
await testdriver.wait(2000);

// Wait for a page transition to settle
await testdriver.find('next page button').click();
await testdriver.wait(1000);
```

<Note>
  For waiting for specific **elements** to appear, prefer `find()` with a `timeout` option. Use `wait()` only for simple time-based pauses.
</Note>

Once your tests can reliably act on a changing UI and [assert](/v7/making-assertions) the results, the next step is figuring out what happened when something does go wrong.

<Card title="Next: Debug" icon="bug" href="/v7/debugging-with-screenshots">
  Use screenshots and run output to see exactly what your test saw and pinpoint failures.
</Card>
