---
name: testdriver:mouse-down
description: Press the mouse button without releasing it
---
<!-- Generated from mouse-down.mdx. DO NOT EDIT. -->

## Overview

The `mouseDown()` method pushes the mouse button at the location of an element. It does not release the button. Use this for drag operations, custom gestures, or when you need precise control of the mouse events. You can call it on an [`Element`](/core-concepts/elements) instance. Or you can use it with a selector.

## Syntax

```javascript
// Mouse down on an element
await element.mouseDown();

// Mouse down using a selector
await ai.mouseDown('selector');
```

## Parameters

When called on an `Element`, no parameters are required.

When called directly on the AI client:

| Parameter | Type | Description |
|-----------|------|-------------|
| `selector` | `string` | The selector describing the element where the mouse button should be pressed |

## Returns

It returns a `Promise<void>`. The promise resolves when TestDriver pushes the mouse button.

## Examples

### Basic Drag Operation

```javascript
// Start dragging an item
const dragItem = await ai.find('file to drag');
await dragItem.mouseDown();

// Move to drop target
const dropTarget = await ai.find('folder to drop into');
await dropTarget.hover();

// Release
await ai.mouseUp();
```

### Drag and Drop with Direct Selectors

```javascript
await ai.mouseDown('draggable card');
await ai.hover('drop zone');
await ai.mouseUp();
```

### Selecting Multiple Items

```javascript
import { test } from 'vitest';
import { chrome } from '@testdriver/sdk';

test('selects multiple items with click and drag', async () => {
  const { ai } = await chrome('https://app.example.com');
  
  // Start selection at first item
  await ai.mouseDown('first item in grid');
  
  // Drag to last item
  await ai.hover('last item in grid');
  
  // Release to complete selection
  await ai.mouseUp();
  
  // Verify multiple items selected
  const selectedItems = await ai.find('selected items count');
  expect(selectedItems.text).toContain('5 items selected');
});
```

### Custom Drawing Application

```javascript
test('draws on canvas', async () => {
  const { ai } = await chrome('https://drawing-app.example.com');
  
  // Start drawing
  await ai.mouseDown('canvas at top-left corner');
  
  // Draw a line by moving mouse
  await ai.hover('canvas at center');
  await ai.hover('canvas at bottom-right corner');
  
  // Stop drawing
  await ai.mouseUp();
  
  // Verify something was drawn
  const canvas = await ai.exec('document.querySelector("canvas").toDataURL()');
  expect(canvas).toBeTruthy();
});
```

### Long Press Gesture

```javascript
test('triggers long press menu', async () => {
  const { ai } = await chrome('https://mobile-app.example.com');
  
  // Press and hold
  await ai.mouseDown('message in chat');
  
  // Wait for long-press menu
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Verify menu appeared before releasing
  const menu = await ai.find('message options menu');
  expect(menu).toBeTruthy();
  
  // Release
  await ai.mouseUp();
});
```

### Resizing UI Elements

```javascript
test('resizes panel', async () => {
  const { ai } = await vscode();
  
  // Grab resize handle
  await ai.mouseDown('sidebar resize handle');
  
  // Drag to new position
  await ai.hover('position 300 pixels from left edge');
  
  // Release
  await ai.mouseUp();
  
  // Verify new size
  const sidebar = await ai.find('sidebar');
  expect(sidebar.width).toBeGreaterThan(250);
});
```

## Important Notes

- Always pair `mouseDown()` with [`mouseUp()`](/mouse-up) to complete the gesture
- The mouse button remains pressed until `mouseUp()` is called
- Use [`hover()`](/hover) to move the mouse while the button is pressed
- For simple drag operations, consider using `ai()` with a natural language description like `"drag file to folder"`

## Related Methods

- [`mouseUp()`](/mouse-up) - Release the mouse button
- [`hover()`](/hover) - Move mouse to element
- [`click()`](/click) - Full click (mouseDown + mouseUp)
- [`doubleClick()`](/double-click) - Double-click on element
- [`rightClick()`](/right-click) - Right-click for context menu
