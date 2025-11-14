# TestDriver SDK Migration Guide

## New Element Finding API

We've introduced a new, more flexible API for finding and interacting with elements. The new `find()` API provides better control and enables polling patterns for dynamic content.

## Quick Comparison

### Old API (Deprecated)
```javascript
// Find and click text
await client.hoverText('Sign In', 'black button below password', 'click');

// Wait for text to appear
await client.waitForText('Login button', 10000);

// Find and click image
await client.hoverImage('submit button icon', 'click');
```

### New API (Recommended)
```javascript
// Find and click text or image
const element = await client.find('Sign In, black button below password').find();
await element.click();

// Poll until element appears (replaces waitForText/waitForImage)
let element = client.find('login button');
while (!element.found()) {
  console.log('waiting for element to be found');
  element = await element.find();
  await new Promise(resolve => setTimeout(resolve, 1000));
}
await element.click();
```

## Migration Examples

### Example 1: Simple Click
**Before:**
```javascript
await client.hoverText('Submit', 'submit button', 'click');
```

**After:**
```javascript
const submitBtn = await client.find('Submit button');
await submitBtn.click();
```

### Example 2: Waiting for Elements
**Before:**
```javascript
await client.waitForText('Welcome', 10000);
await client.hoverText('Welcome', null, 'click');
```

**After:**
```javascript
let element;
const maxAttempts = 10;
let attempts = 0;

while (!element?.found() && attempts < maxAttempts) {
  element = await client.find('Welcome');
  if (!element.found()) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  attempts++;
}

if (element?.found()) {
  await element.click();
}
```

### Example 3: Hover Actions
**Before:**
```javascript
await client.hoverText('Menu', null, 'hover');
```

**After:**
```javascript
const menu = await client.find('Menu').find();
await menu.hover();
```

### Example 4: Different Click Types
**Before:**
```javascript
await client.hoverText('File', null, 'right-click');
await client.hoverText('Save', null, 'double-click');
```

**After:**
```javascript
const file = await client.find('File').find();
await file.rightClick();

const save = await client.find('Save').find();
await save.doubleClick();

// Or use the generic click() method
await file.click('right-click');
await save.click('double-click');
```

### Example 5: Conditional Logic
**Before:**
```javascript
try {
  await client.waitForText('Error message', 2000);
  // Handle error
} catch (e) {
  // No error present
}
```

**After:**
```javascript
const errorMsg = await client.find('Error message').find();
if (errorMsg.found()) {
  // Handle error
  console.log('Error found at:', errorMsg.getCoordinates());
} else {
  // No error present
}
```

## New Element API Reference

### `client.find(description)`
Creates an Element instance for finding and interacting with elements.

**Parameters:**
- `description` (string): Natural language description of the element

**Returns:** `Element` instance

**Example:**
```javascript
const button = client.find('the sign in button');
```

### `element.find([newDescription])`
Attempts to locate the element on screen.

**Parameters:**
- `newDescription` (optional string): New description to search for

**Returns:** `Promise<Element>` - The same Element instance (for chaining)

**Example:**
```javascript
const element = await client.find('login button').find();

// Or with a new description
element = await element.find('sign in button');
```

### `element.found()`
Check if the element was successfully located.

**Returns:** `boolean` - true if element coordinates were found

**Example:**
```javascript
const element = await client.find('button').find();
if (element.found()) {
  console.log('Element found!');
}
```

### `element.click([action])`
Click on the element.

**Parameters:**
- `action` (optional): Click action type - `'click'`, `'right-click'`, `'double-click'`

**Returns:** `Promise<void>`

**Example:**
```javascript
await element.click();
await element.click('right-click');
```

### `element.hover()`
Hover over the element.

**Returns:** `Promise<void>`

**Example:**
```javascript
await element.hover();
```

### `element.doubleClick()`
Double-click on the element. Convenience method for `element.click('double-click')`.

**Returns:** `Promise<void>`

**Example:**
```javascript
await element.doubleClick();
```

### `element.rightClick()`
Right-click on the element. Convenience method for `element.click('right-click')`.

**Returns:** `Promise<void>`

**Example:**
```javascript
await element.rightClick();
```

### `element.mouseDown()`
Press mouse button down on this element (useful for drag operations).

**Returns:** `Promise<void>`

**Example:**
```javascript
const source = await client.find('draggable item').find();
await source.mouseDown();
```

### `element.mouseUp()`
Release mouse button on this element (useful for drag operations).

**Returns:** `Promise<void>`

**Example:**
```javascript
const target = await client.find('drop zone').find();
await target.mouseUp();
```

### `element.getCoordinates()`
Get the screen coordinates of the element.

**Returns:** `{x, y, centerX, centerY}` or `null` if not found

**Example:**
```javascript
const coords = element.getCoordinates();
if (coords) {
  console.log(`Element at: ${coords.x}, ${coords.y}`);
}
```

### `element.getResponse()`
Get the full API response data from the locate operation.

**Returns:** `Object | null` - Full response containing all available data

**Example:**
```javascript
const response = element.getResponse();
console.log('Full response:', response);
```

## Element Properties

The Element class exposes many properties from the API response:

### Coordinate Properties
- `element.x` - X coordinate (top-left corner)
- `element.y` - Y coordinate (top-left corner)
- `element.centerX` - X coordinate of element center
- `element.centerY` - Y coordinate of element center

### Dimension Properties
- `element.width` - Width of the element (if available)
- `element.height` - Height of the element (if available)
- `element.boundingBox` - Bounding box data (if available)

### Match Quality Properties
- `element.confidence` - Confidence score of the match (0-1)
- `element.screenshot` - Base64 encoded screenshot of the element
- `element.text` - Text content of the element (if available)
- `element.label` - Label/aria-label of the element (if available)

### Example Usage
```javascript
const button = await client.find('login button');

if (button.found()) {
  console.log('Position:', { x: button.x, y: button.y });
  console.log('Center:', { x: button.centerX, y: button.centerY });
  console.log('Size:', { width: button.width, height: button.height });
  console.log('Confidence:', button.confidence);
  console.log('Text:', button.text);
  
  // Save screenshot for debugging
  if (button.screenshot) {
    const fs = require('fs');
    fs.writeFileSync('button.png', Buffer.from(button.screenshot, 'base64'));
  }
  
  // Conditional actions based on properties
  if (button.confidence > 0.8) {
    await button.click();
  }
}
```

For a complete example, see `examples/sdk-element-properties.js`.

## Common Patterns

### Pattern 1: Find and Click
```javascript
const element = await client.find('description').find();
if (element.found()) {
  await element.click();
}
```

### Pattern 2: Polling with Timeout
```javascript
const element = client.find('element description');
const timeoutMs = 10000;
const startTime = Date.now();

while (!element.found() && (Date.now() - startTime) < timeoutMs) {
  element = await element.find();
  if (!element.found()) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

if (!element.found()) {
  throw new Error('Element not found within timeout');
}
```

### Pattern 3: Retry with Different Descriptions
```javascript
let element = client.find('primary button');
element = await element.find();

if (!element.found()) {
  element = await element.find('submit button');
}

if (!element.found()) {
  element = await element.find('blue button on the right');
}

if (element.found()) {
  await element.click();
}
```

### Pattern 4: Helper Function for Waiting
```javascript
async function waitForElement(client, description, timeoutMs = 10000) {
  const element = client.find(description);
  const startTime = Date.now();
  
  while (!element.found() && (Date.now() - startTime) < timeoutMs) {
    await element.find();
    if (!element.found()) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  if (!element.found()) {
    throw new Error(`Element "${description}" not found within ${timeoutMs}ms`);
  }
  
  return element;
}

// Usage
const button = await waitForElement(client, 'login button', 5000);
await button.click();
```

## Deprecated Methods

The following methods are now deprecated and will be removed in a future version:

- ❌ `client.hoverText()` → ✅ Use `client.find().find()` + `element.click()`
- ❌ `client.hoverImage()` → ✅ Use `client.find().find()` + `element.click()`
- ❌ `client.waitForText()` → ✅ Use polling pattern with `client.find()`
- ❌ `client.waitForImage()` → ✅ Use polling pattern with `client.find()`
- ❌ `client.wait()` → ✅ Use element polling instead of arbitrary waits when possible

## Benefits of the New API

1. **More Explicit**: Clear separation between finding and interacting
2. **Better Error Handling**: Can check if element exists before interacting
3. **Flexible Polling**: Custom polling logic for dynamic content
4. **Unified Interface**: Same API for text and images
5. **More Control**: Access to element state and coordinates
6. **Composable**: Element instances can be stored and reused

## TypeScript Support

The new API is fully typed:

```typescript
import TestDriver, { Element } from 'testdriverai';

const client = new TestDriver(process.env.TD_API_KEY);
await client.connect();

const element: Element = await client.find('button').find();
const found: boolean = element.found();
const coords = element.getCoordinates(); // {x, y, centerX, centerY} | null
```

## Questions?

For more examples, see:
- `examples/sdk-find-example.js` - Comprehensive examples of the new API
- `testdriver/acceptance-sdk/hover-text.test.mjs` - Updated test example
