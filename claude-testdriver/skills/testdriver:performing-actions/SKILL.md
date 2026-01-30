---
name: testdriver:performing-actions
description: Click, type, hover, scroll and more with TestDriver
---
<!-- Generated from performing-actions.mdx. DO NOT EDIT. -->

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
await testdriver.scrollUntilText('Footer content');

// Extracting information from screen
const price = await testdriver.extract('the total price');
const orderNumber = await testdriver.extract('the order confirmation number');
```

## Chaining Actions

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
