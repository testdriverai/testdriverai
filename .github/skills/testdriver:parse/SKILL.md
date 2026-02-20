```skill
---
name: testdriver:parse
description: Detect all UI elements on screen using OmniParser
---
<!-- Generated from parse.mdx. DO NOT EDIT. -->

## Overview

Parse the current screen using OmniParser v2 to detect all visible UI elements. Returns structured data including element types, text content, interactivity levels, and bounding box coordinates.

This method analyzes the entire screen and returns every detected element. It's useful for:
- Understanding the full UI layout of a screen
- Finding all clickable or interactive elements
- Building custom element-based logic
- Debugging what elements TestDriver can detect
- Accessibility auditing

<Note>
  **Availability**: `parse()` requires an enterprise or self-hosted plan. It uses OmniParser v2 server-side for element detection.
</Note>

## Syntax

```javascript
const result = await testdriver.parse()
```

## Parameters

None.

## Returns

`Promise<ParseResult>` - Object containing detected UI elements

### ParseResult

| Property | Type | Description |
|----------|------|-------------|
| `elements` | `ParsedElement[]` | Array of detected UI elements |
| `annotatedImageUrl` | `string` | URL of the annotated screenshot with bounding boxes |
| `imageWidth` | `number` | Width of the analyzed screenshot |
| `imageHeight` | `number` | Height of the analyzed screenshot |

### ParsedElement

| Property | Type | Description |
|----------|------|-------------|
| `index` | `number` | Element index |
| `type` | `string` | Element type (e.g. `"text"`, `"icon"`, `"button"`) |
| `content` | `string` | Text content or description of the element |
| `interactivity` | `string` | Interactivity level (e.g. `"clickable"`, `"non-interactive"`) |
| `bbox` | `object` | Bounding box in pixel coordinates `{x0, y0, x1, y1}` |
| `boundingBox` | `object` | Bounding box as `{left, top, width, height}` |

## Examples

### Get All Elements on Screen

```javascript
const result = await testdriver.parse();
console.log(`Found ${result.elements.length} elements`);

result.elements.forEach((el, i) => {
  console.log(`${i + 1}. [${el.type}] "${el.content}" (${el.interactivity})`);
});
```

### Find Clickable Elements

```javascript
const result = await testdriver.parse();

const clickable = result.elements.filter(e => e.interactivity === 'clickable');
console.log(`Found ${clickable.length} clickable elements`);
```

### Find and Click an Element by Content

```javascript
const result = await testdriver.parse();

const submitBtn = result.elements.find(e => 
  e.content.toLowerCase().includes('submit') && e.interactivity === 'clickable'
);

if (submitBtn) {
  const x = Math.round((submitBtn.bbox.x0 + submitBtn.bbox.x1) / 2);
  const y = Math.round((submitBtn.bbox.y0 + submitBtn.bbox.y1) / 2);
  await testdriver.click({ x, y });
}
```

### Filter by Element Type

```javascript
const result = await testdriver.parse();

const textElements = result.elements.filter(e => e.type === 'text');
const icons = result.elements.filter(e => e.type === 'icon');
const buttons = result.elements.filter(e => e.type === 'button');
```

## Best Practices

- Use `find()` for targeting specific elements — `parse()` is for full UI analysis
- Filter by `interactivity` to distinguish clickable vs non-interactive elements
- Wait for the page to stabilize before calling `parse()`
- Use the `annotatedImageUrl` for visual debugging

## Related

- [find()](/v7/find) - AI-powered element location
- [assert()](/v7/assert) - Make AI-powered assertions about screen state
- [screenshot()](/v7/screenshot) - Capture screenshots
- [Elements Reference](/v7/elements) - Complete Element API
```
