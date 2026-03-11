---
name: testdriver:right-click
description: Perform a right-click action to open context menus
---
<!-- Generated from right-click.mdx. DO NOT EDIT. -->

## Overview

The `rightClick()` method performs a right-click action on an element, typically used to open context menus. You can either call it on an [`Element`](/v7/core-concepts/elements) instance or use it directly with a selector.

## Syntax

```javascript
// Right-click on an element
await element.rightClick();

// Right-click using a selector
await ai.rightClick('selector');
```

## Parameters

When called on an `Element`, no parameters are required.

When called directly on the AI client:

| Parameter | Type | Description |
|-----------|------|-------------|
| `selector` | `string` | The selector describing the element to right-click |

## Returns

Returns a `Promise<void>` that resolves when the right-click action completes.

## Examples

### Right-Click to Open Context Menu

```javascript
const fileItem = await ai.find('README.md file');
await fileItem.rightClick();

// Select menu option
await ai.click('Delete from context menu');
```

### Direct Right-Click with Selector

```javascript
await ai.rightClick('image in the gallery');
await ai.click('Save image as');
```

### VS Code Context Menu

```javascript
import { test } from 'vitest';
import { vscode } from '@testdriver/sdk';

test('renames a file via context menu', async () => {
  const { ai } = await vscode();
  
  // Right-click on a file
  await ai.rightClick('test.js in the file explorer');
  
  // Click rename option
  await ai.click('Rename');
  
  // Type new name
  await ai.type('test.spec.js');
  await ai.pressKeys('Enter');
  
  // Verify rename
  const renamedFile = await ai.find('test.spec.js in the file explorer');
  expect(renamedFile).toBeTruthy();
});
```

### Browser Context Menu

```javascript
import { test } from 'vitest';
import { chrome } from '@testdriver/sdk';

test('opens link in new tab', async () => {
  const { ai } = await chrome('https://example.com');
  
  // Right-click on a link
  await ai.rightClick('Documentation link');
  
  // Select "Open in new tab"
  await ai.click('Open link in new tab');
});
```

### Custom Context Menu in Web App

```javascript
test('uses custom context menu', async () => {
  const { ai } = await chrome('https://app.example.com');
  
  // Right-click on custom element
  await ai.rightClick('project item in the list');
  
  // Wait for custom menu to appear
  await ai.find('custom context menu');
  
  // Click menu option
  await ai.click('Duplicate project');
  
  // Verify duplication
  const duplicatedProject = await ai.find('project item (copy)');
  expect(duplicatedProject).toBeTruthy();
});
```

## Related Methods

- [`click()`](/v7/click) - Single click on an element
- [`doubleClick()`](/v7/double-click) - Double-click on an element
- [`mouseDown()`](/v7/mouse-down) - Press mouse button without releasing
- [`mouseUp()`](/v7/mouse-up) - Release mouse button
- [`hover()`](/v7/hover) - Move mouse over element without clicking
