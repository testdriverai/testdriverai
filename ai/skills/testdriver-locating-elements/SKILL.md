---
name: testdriver:locating-elements
description: Locate UI elements using AI
---
<!-- Generated from locating-elements.mdx. DO NOT EDIT. -->

## Overview

The TestDriver element finding system uses AI. It finds elements on the screen with natural language descriptions. The `find()` method returns an `Element` object. You can [interact with the object](/interacting-with-your-app).

## Finding Elements

### find()

Find an element on the screen with a natural language description.

```javascript
const element = await testdriver.find(description)
```

**Parameters:**
- `description` (string) - A natural language description of the element to find

**Returns:** `Promise<Element>` - The Element instance that TestDriver found

**Example:**
```javascript
// Find a button
const submitButton = await testdriver.find('the submit button');

// Find an input field with context
const emailField = await testdriver.find('email input field in the login form');

// Find an element by visual characteristics
const redButton = await testdriver.find('red button in the top right corner');
```

<Tip>
  Be specific in your descriptions. Include visual details, location context, or nearby text to make the accuracy better.
</Tip>

## Element Class

The `Element` class represents a located (or to-be-located) UI element. It provides methods for interaction and properties for element information. For interaction methods like `click()` and `hover()`, see [Interacting With Your App](/interacting-with-your-app).

### Methods

#### found()

Check if the element was successfully located.

```javascript
element.found()
```

**Returns:** `boolean` - True if element coordinates were found

**Example:**
```javascript
const element = await testdriver.find('login button');
if (element.found()) {
  await element.click();
} else {
  console.log('Element not found');
}
```

#### find()

Re-locate the element, optionally with a new description.

```javascript
await element.find(newDescription)
```

**Parameters:**
- `newDescription` (string, optional) - New description to search for

**Returns:** `Promise<Element>` - This element instance

**Example:**
```javascript
// Re-locate if the UI changed
const element = await testdriver.find('submit button');
// ... page updates ...
await element.find(); // Re-locate with same description

// Or update the description
await element.find('blue submit button'); // Now looking for blue button
```

### Properties

Element properties provide additional information about located elements. Properties are available after a successful `find()` call.

#### coordinates

Get the element's coordinates object containing all position information.

```javascript
const coords = element.getCoordinates()
// or access directly
element.coordinates
```

**Returns:** `Object | null` - Coordinate object with `{ x, y, centerX, centerY }`

**Example:**
```javascript
const button = await testdriver.find('submit button');
const coords = button.coordinates;

if (coords) {
  console.log(`Top-left: (${coords.x}, ${coords.y})`);
  console.log(`Center: (${coords.centerX}, ${coords.centerY})`);
}
```

#### x, y, centerX, centerY

Direct access to coordinate values. Always available after successful `find()`.

```javascript
element.x        // Top-left X coordinate (number)
element.y        // Top-left Y coordinate (number)
element.centerX  // Center X coordinate (number)
element.centerY  // Center Y coordinate (number)
```

**Example:**
```javascript
const button = await testdriver.find('submit button');
console.log(`Button at: (${button.x}, ${button.y})`);
console.log(`Button center: (${button.centerX}, ${button.centerY})`);

// Use for custom mouse operations
await testdriver.click(button.centerX, button.centerY);
```

#### width, height

Element dimensions in pixels. Available when AI detects element bounds.

```javascript
element.width   // Width in pixels (number | null)
element.height  // Height in pixels (number | null)
```

**Example:**
```javascript
const button = await testdriver.find('submit button');

if (button.width && button.height) {
  console.log(`Button size: ${button.width}x${button.height}px`);
  
  // Check if button is large enough
  if (button.width < 50) {
    console.warn('Button might be too small');
  }
}
```

#### boundingBox

Complete bounding box information including position and dimensions.

```javascript
element.boundingBox
```

**Returns:** `Object | null` - Bounding box with all dimension data

```typescript
{
  x: number,        // Top-left X
  y: number,        // Top-left Y
  width: number,    // Width in pixels
  height: number    // Height in pixels
}
```

**Example:**
```javascript
const element = await testdriver.find('dialog box');

if (element.boundingBox) {
  const { x, y, width, height } = element.boundingBox;
  console.log(`Dialog: ${width}x${height} at (${x}, ${y})`);
  
  // Calculate if element is in viewport
  const rightEdge = x + width;
  const bottomEdge = y + height;
  console.log(`Element extends to (${rightEdge}, ${bottomEdge})`);
}
```

#### screenshot

Base64-encoded PNG screenshot of the screen when element was found. Only available in DEBUG mode or when an error occurs.

```javascript
element.screenshot
```

**Returns:** `string | null` - Base64-encoded PNG image

**Example:**
```javascript
const element = await testdriver.find('error message');

if (element.screenshot) {
  // Save screenshot to file
  const fs = require('fs');
  const base64Data = element.screenshot.replace(/^data:image\/\w+;base64,/, '');
  fs.writeFileSync('element-screenshot.png', Buffer.from(base64Data, 'base64'));
  console.log('Screenshot saved');
}
```

<Warning>
  Screenshots can be large. They're automatically excluded from error messages to prevent memory issues.
</Warning>

#### text

Text content extracted from the element by AI (if available).

```javascript
element.text
```

**Returns:** `string | null` - Element's text content

**Example:**
```javascript
const message = await testdriver.find('notification message');

if (message.text) {
  console.log('Message says:', message.text);
  
  // Use text content in assertions
  if (message.text.includes('success')) {
    console.log('Success message detected');
  }
}

// Another example - extracting button label
const button = await testdriver.find('blue button');
console.log('Button text:', button.text); // "Submit"
```

#### label

Accessible label or name of the element (if available). Useful for verifying accessibility.

```javascript
element.label
```

**Returns:** `string | null` - Accessible label

**Example:**
```javascript
const input = await testdriver.find('first input field');

if (input.label) {
  console.log('Input label:', input.label); // "Email Address"
}
```

#### confidence

AI confidence score for the element match (0-1, where 1 is perfect confidence).

```javascript
element.confidence
```

**Returns:** `number | null` - Confidence score between 0 and 1

**Example:**
```javascript
const element = await testdriver.find('submit button');

if (element.confidence !== null) {
  const percentage = (element.confidence * 100).toFixed(1);
  console.log(`Match confidence: ${percentage}%`);
  
  if (element.confidence < 0.8) {
    console.warn('⚠️ Low confidence match - element might not be correct');
  } else if (element.confidence > 0.95) {
    console.log('✅ High confidence match');
  }
}
```

<Tip>
  Confidence scores below 0.8 may indicate the element description was ambiguous or the wrong element was found.
</Tip>

### Property Availability

| Property | When Available |
|----------|---------------|
| `x`, `y`, `centerX`, `centerY` | ✅ Always after successful `find()` |
| `coordinates` | ✅ Always after successful `find()` |
| `width`, `height` | ⚠️ When AI detects element bounds |
| `boundingBox` | ⚠️ When AI detects element bounds |
| `text` | ⚠️ When AI extracts text content |
| `label` | ⚠️ When element has accessible label |
| `confidence` | ✅ Always after AI element finding |
| `screenshot` | ⚠️ Only in DEBUG mode or on errors |

<Note>
  Properties marked with ⚠️ may be `null` depending on what the AI could detect from the screenshot.
</Note>

## JSON Serialization

Element objects can be safely serialized using `JSON.stringify()` for logging, debugging, and data storage. Circular references are automatically removed:

```javascript
const element = await testdriver.find('login button');

// Safe to stringify - no circular reference errors!
console.log(JSON.stringify(element, null, 2));
```

**Serialized output includes:**

```json
{
  "description": "login button",
  "coordinates": { "x": 100, "y": 200, "centerX": 150, "centerY": 225 },
  "found": true,
  "threshold": 0.01,
  "x": 100,
  "y": 200,
  "cache": {
    "hit": true,
    "strategy": "pixel-diff",
    "createdAt": "2025-12-09T10:30:00.000Z",
    "diffPercent": 0.0023,
    "imageUrl": "https://cache.testdriver.ai/..."
  },
  "similarity": 0.98,
  "confidence": 0.95,
  "selector": "button#login",
  "aiResponse": "Found the blue login button in the center of the form..."
}
```

**Serialized properties:**

| Property | Type | Description |
|----------|------|-------------|
| `description` | string | Element search description |
| `coordinates` | object | Full coordinate object `{x, y, centerX, centerY}` |
| `found` | boolean | Whether element was located |
| `threshold` | number | Cache threshold used for this find |
| `x`, `y` | number | Top-left coordinates |
| `cache.hit` | boolean | Whether cache was used |
| `cache.strategy` | string | Cache strategy (e.g., "pixel-diff") |
| `cache.createdAt` | string | ISO timestamp when cache was created |
| `cache.diffPercent` | number | Pixel difference from cached image |
| `cache.imageUrl` | string | URL to cached screenshot |
| `similarity` | number | Similarity score (0-1) |
| `confidence` | number | AI confidence score (0-1) |
| `selector` | string | CSS/XPath selector if available |
| `aiResponse` | string | AI's explanation of what it found |

**Use cases:**

```javascript
// Debugging element detection
const element = await testdriver.find('submit button');
if (!element.found()) {
  console.error('Element not found:', JSON.stringify(element, null, 2));
}

// Logging cache performance
const data = JSON.parse(JSON.stringify(element));
if (data.cache.hit) {
  console.log(`Cache hit! Diff: ${(data.cache.diffPercent * 100).toFixed(2)}%`);
}

// Sharing element data across processes
const elementData = JSON.stringify(element);
// Send to another process, log to file, etc.
```

<Tip>
  Use JSON serialization when you need to log element data or when debugging why an element wasn't found. The serialized output excludes large binary data (screenshots) and circular references.
</Tip>

## Best Practices

<AccordionGroup>
  <Accordion title="Be specific with descriptions">
    Include visual details, position context, and nearby text:
    
    ```javascript
    // ❌ Too vague
    await testdriver.find('button');
    
    // ✅ Specific
    await testdriver.find('blue submit button below the email field');
    ```
  </Accordion>
  
  <Accordion title="Check if element was found">
    Always verify elements were located before interacting:
    
    ```javascript
    const element = await testdriver.find('submit button');
    if (!element.found()) {
      throw new Error('Submit button not found');
    }
    await element.click();
    ```
  </Accordion>
</AccordionGroup>
