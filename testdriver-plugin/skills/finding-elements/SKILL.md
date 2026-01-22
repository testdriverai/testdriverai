---
name: finding-elements
description: Find elements in TestDriver tests. Use when locating UI elements by natural language description, understanding element properties, or debugging element detection.
---

# Finding Elements

Read: `node_modules/testdriverai/docs/v7/find.mdx`
Read: `node_modules/testdriverai/docs/v7/elements.mdx`
Read: `node_modules/testdriverai/docs/v7/locating-elements.mdx`

## Basic Usage

```javascript
const button = await testdriver.find("Sign In button");
const input = await testdriver.find("Email input field");
const link = await testdriver.find("Forgot password link");
```

## Find All Matching Elements

```javascript
const items = await testdriver.findAll("Product cards in the grid");
console.log(`Found ${items.length} products`);
```

## Element Properties

```javascript
const element = await testdriver.find("Submit button");

// Check if found
console.log(element.found());  // boolean

// Coordinates
console.log(element.x, element.y);             // top-left
console.log(element.centerX, element.centerY); // center

// Dimensions
console.log(element.width, element.height);

// AI detection info
console.log(element.confidence);  // 0-1
console.log(element.text);        // detected text
console.log(element.boundingBox); // full box
```

## Tips for Good Element Descriptions

**Be specific:**
- ✅ "Sign In button in the header"
- ❌ "button"

**Include context:**
- ✅ "Email input field in the login form"
- ❌ "input"

**Describe visual appearance:**
- ✅ "Blue Submit button at bottom of form"
- ✅ "User avatar in top right corner"

## Debugging

Log element info to understand what AI sees:

```javascript
const element = await testdriver.find("Some element");
console.log("Found:", element.found());
console.log("Position:", element.x, element.y);
console.log("Size:", element.width, element.height);
console.log("Confidence:", element.confidence);
console.log("Text:", element.text);
```

## Examples

See `node_modules/testdriverai/examples/hover-text.test.mjs`
