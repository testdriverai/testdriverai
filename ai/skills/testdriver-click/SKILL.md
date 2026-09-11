---
name: testdriver:click
description: Click at specific coordinates or on elements
---
<!-- Generated from click.mdx. DO NOT EDIT. -->

## Element Click

When you call this on an Element object, it clicks on the found element.

### Syntax

```javascript
await element.click(action)
```

### Parameters

<ParamField path="action" type="string" default="click">
  Type of click action: `'click'`, `'double-click'`, `'right-click'`, `'hover'`, `'mouseDown'`, `'mouseUp'`
</ParamField>

### Returns

`Promise<void>`

### Examples

```javascript
// Regular click
const button = await testdriver.find('submit button');
await button.click();

// Double-click
const file = await testdriver.find('README.txt file');
await file.click('double-click');

// Right-click
const item = await testdriver.find('menu item');
await item.click('right-click');

// Hover (same as element.hover())
const tooltip = await testdriver.find('info icon');
await button.click('hover');
```

## Coordinate Click

Click at specific screen coordinates.

### Syntax

```javascript
await testdriver.click(x, y, action)
```

### Parameters

<ParamField path="x" type="number" required>
  X coordinate
</ParamField>

<ParamField path="y" type="number" required>
  Y coordinate
</ParamField>

<ParamField path="action" type="string" default="click">
  Type of click: `'click'`, `'double-click'`, `'right-click'`, `'mouseDown'`, `'mouseUp'`
</ParamField>

### Returns

`Promise<void>`

### Examples

```javascript
// Click at coordinates
await testdriver.click(500, 300);

// Double-click at coordinates
await testdriver.click(500, 300, 'double-click');

// Right-click at coordinates
await testdriver.click(500, 300, 'right-click');
```

## Click Actions

### Regular Click

One left-click action.

```javascript
const button = await testdriver.find('Login button');
await button.click();
```

### Double Click

A double-click action. It usually opens files or selects text.

```javascript
const file = await testdriver.find('document.pdf');
await file.click('double-click');

// Or use the dedicated method
await file.doubleClick();
```

### Right Click

Right-click to open context menus.

```javascript
const folder = await testdriver.find('Documents folder');
await folder.click('right-click');

// Or use the dedicated method
await folder.rightClick();
```

### Mouse Down / Mouse Up

Use these for drag operations or custom click behavior.

```javascript
const draggable = await testdriver.find('draggable item');
await draggable.click('mouseDown');

// Move to target
const dropZone = await testdriver.find('drop zone');
await dropZone.hover();
await dropZone.click('mouseUp');

// Or use dedicated methods
await draggable.mouseDown();
await dropZone.mouseUp();
```

## Best Practices

<Check>
  **Prefer element clicks to coordinate clicks**
  
  A click on an element is more reliable. It does not depend on the resolution:
  
  ```javascript
  // ✅ Preferred
  const button = await testdriver.find('submit button');
  await button.click();
  
  // ❌ Avoid (fragile)
  await testdriver.click(500, 300);
  ```
</Check>

<Check>
  **Make sure that TestDriver found the element**
  
  ```javascript
  const element = await testdriver.find('button');
  if (!element.found()) {
    throw new Error('Element not found');
  }
  await element.click();
  ```
</Check>

<Warning>
  **TestDriver must find the element before you click it**
  
  The `find()` method finds elements automatically. But a click on an element that TestDriver did not find throws an error:
  
  ```javascript
  const element = await testdriver.find('button');
  // This will throw if element wasn't found
  await element.click();
  ```
</Warning>

## Use Cases

<AccordionGroup>
  <Accordion title="Button Clicks">
    ```javascript
    const submitBtn = await testdriver.find('submit button');
    await submitBtn.click();
    
    const cancelBtn = await testdriver.find('cancel button');
    await cancelBtn.click();
    ```
  </Accordion>
  
  <Accordion title="Opening Files">
    ```javascript
    const file = await testdriver.find('report.pdf file icon');
    await file.doubleClick();
    ```
  </Accordion>
  
  <Accordion title="Context Menus">
    ```javascript
    const item = await testdriver.find('file item');
    await item.rightClick();
    
    // Select menu option
    const deleteOption = await testdriver.find('Delete option');
    await deleteOption.click();
    ```
  </Accordion>
  
  <Accordion title="Drag and Drop">
    ```javascript
    const source = await testdriver.find('source item');
    await source.mouseDown();
    
    const target = await testdriver.find('target zone');
    await target.hover();
    await target.mouseUp();
    ```
  </Accordion>
</AccordionGroup>

## Complete Example

```javascript
import { beforeAll, afterAll, describe, it } from 'vitest';
import TestDriver from 'testdriverai';

describe('Click Interactions', () => {
  let testdriver;

  beforeAll(async () => {
    client = new TestDriver(process.env.TD_API_KEY);
    await testdriver.auth();
    await testdriver.connect();
  });

  afterAll(async () => {
    await testdriver.disconnect();
  });

  it('should perform various click actions', async () => {
    await testdriver.focusApplication('Google Chrome');
    
    // Regular click
    const loginBtn = await testdriver.find('login button');
    await loginBtn.click();
    
    // Right-click for context menu
    const profileIcon = await testdriver.find('profile icon');
    await profileIcon.rightClick();
    
    const settingsOption = await testdriver.find('Settings menu option');
    await settingsOption.click();
    
    // Double-click to edit
    const nameField = await testdriver.find('name display field');
    await nameField.doubleClick();
    
    // Verify state
    await testdriver.assert('name field is now editable');
  });

  it('should perform drag and drop', async () => {
    const item = await testdriver.find('draggable item');
    await item.mouseDown();
    
    // Drag to new location
    const dropTarget = await testdriver.find('drop area');
    await dropTarget.hover();
    await dropTarget.mouseUp();
    
    // Verify
    await testdriver.assert('item is in the drop area');
  });
});
```

## Related Methods

- [`find()`](/find) - Find elements to click
- [`hover()`](/hover) - Put the cursor on the element without a click
- [`doubleClick()`](/double-click) - The double-click method
- [`rightClick()`](/right-click) - The right-click method
