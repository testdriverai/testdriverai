---
name: testdriver:scroll
description: Scroll pages and elements
---
<!-- Generated from scroll.mdx. DO NOT EDIT. -->

## Overview

Scroll the page or active element in any direction using mouse wheel or keyboard.

<Warning>
  **Focus Requirements**
  
  Scrolling requires the page or a frame to be focused. If an input field or other interactive element has focus, scroll commands may not work as expected. Before scrolling, ensure focus is on the page by:
  - Clicking on a non-interactive area (e.g., page background)
  - Pressing the Escape key to unfocus interactive elements
  - Clicking outside of input fields or text areas
  
  **If scroll is still not working**, try using Page Down/Page Up keys directly:
  ```javascript
  await testdriver.pressKeys(['pagedown']); // Scroll down
  await testdriver.pressKeys(['pageup']);   // Scroll up
  ```
</Warning>

## Syntax

```javascript
await testdriver.scroll(direction, options)
```

## Parameters

<ParamField path="direction" type="string" default="down">
  Direction to scroll: `'up'`, `'down'`
</ParamField>

<ParamField path="options" type="object">
  <Expandable title="properties">
    <ParamField path="amount" type="number" default="300">
      Amount to scroll in pixels
    </ParamField>
  </Expandable>
</ParamField>

## Returns

`Promise<void>`

## Examples

### Basic Scrolling

```javascript
// Scroll down (default)
await testdriver.scroll();

// Scroll down 5 clicks
await testdriver.scroll('down', { amount: 5 });

// Scroll up
await testdriver.scroll('up');

// Scroll up 2 clicks
await testdriver.scroll('up', { amount: 2 });
```

### Horizontal Scrolling

```javascript
// Scroll right
await testdriver.scroll('right', { amount: 3 });

// Scroll left
await testdriver.scroll('left', { amount: 3 });
```

### Scroll Methods

```javascript
// Mouse wheel scroll (default)
await testdriver.scroll('down', { amount: 3 });

// For keyboard-based scrolling, use pressKeys instead
await testdriver.pressKeys(['pagedown']);
```

## Best Practices

<Check>
  **Ensure page has focus before scrolling**
  
  ```javascript
  // After typing in an input, unfocus it first
  await testdriver.find('email input').click();
  await testdriver.type('user@example.com');
  
  // Click elsewhere or press Escape before scrolling
  await testdriver.pressKeys(['escape']);
  // Or click a non-interactive area
  // await testdriver.find('page background').click();
  
  // Now scroll will work properly
  await testdriver.scroll('down');
  
  // If scroll still doesn't work, use Page Down directly
  // await testdriver.pressKeys(['pagedown']);
  ```
</Check>

<Check>
  **Control scroll distance with the options object**
  
  ```javascript
  // For web pages, mouse scroll works well
  await testdriver.scroll('down', { amount: 3 });
  
  // For desktop apps or when mouse doesn't work, use keyboard
  await testdriver.pressKeys(['pagedown']);
  ```
</Check>

<Warning>
  **Keyboard scroll uses Page Down/Up**
  
  Keyboard scrolling typically moves by one "page" at a time, which may be more than the specified click amount. It's more compatible but less precise than mouse scrolling.
</Warning>

## Use Cases

<AccordionGroup>
  <Accordion title="Infinite Scroll">
    ```javascript
    // Scroll multiple times for infinite scroll
    for (let i = 0; i < 5; i++) {
      await testdriver.scroll('down', { amount: 5 });
      await new Promise(r => setTimeout(r, 1000)); // Wait for load
    }
    ```
  </Accordion>
  
  <Accordion title="Horizontal Gallery">
    ```javascript
    // Navigate horizontal carousel
    await testdriver.scroll('right', { amount: 3 });
    await new Promise(r => setTimeout(r, 500));
    
    const nextImage = await testdriver.find('next image in carousel');
    await nextImage.click();
    ```
  </Accordion>
</AccordionGroup>

## Complete Example

```javascript
import { beforeAll, afterAll, describe, it } from 'vitest';
import TestDriver from 'testdriverai';

describe('Scrolling', () => {
  let testdriver;

  beforeAll(async () => {
    client = new TestDriver(process.env.TD_API_KEY);
    await testdriver.auth();
    await testdriver.connect();
  });

  afterAll(async () => {
    await testdriver.disconnect();
  });

  it('should scroll to find elements', async () => {
    await testdriver.focusApplication('Google Chrome');
    
    // Scroll down the page
    await testdriver.scroll('down', { amount: 5 });
    
    // Click footer link
    const privacyLink = await testdriver.find('Privacy Policy link');
    await privacyLink.click();
    
    await testdriver.assert('privacy policy page is displayed');
  });

  it('should handle infinite scroll', async () => {
    await testdriver.focusApplication('Google Chrome');
    
    // Scroll multiple times to load content
    for (let i = 0; i < 3; i++) {
      await testdriver.scroll('down', { amount: 5 });
      await new Promise(r => setTimeout(r, 1500)); // Wait for load
    }
    
    // Verify content loaded
    await testdriver.assert('more than 10 items are visible');
  });
});
```

## Related Methods

- [`find()`](/v7/find) - Locate elements after scrolling
- [`pressKeys()`](/v7/press-keys) - Use Page Down/Up keys
- [`wait()`](/v7/wait) - Wait after scrolling
