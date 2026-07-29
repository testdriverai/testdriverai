---
name: testdriver:making-assertions
description: Locate elements and verify app state with AI-powered assertions
---
<!-- Generated from making-assertions.mdx. DO NOT EDIT. -->

Once a test runs, validate that the app did what it should. Validation has two parts: locating the elements you want to check, and making assertions about the state of your app. TestDriver uses AI as a judge, returning a boolean plus reasoning about whether your app is in the expected state.

## Locating Elements

### Locating Single Elements

Use natural language to describe elements. Descriptions should be specific enough to locate the element, but not too-specific that they break with minor UI changes. For example:

```javascript
await testdriver.find('email input field');
await testdriver.find('first product card in the grid');
await testdriver.find('dropdown menu labeled "Country"');
```

<Info>TestDriver will cache found elements for improved performance on subsequent calls. Learn more about [element caching here](/v7/caching).</Info>

### Debugging Found Elements

After finding an element, you can inspect its properties for debugging:

```javascript
const button = await testdriver.find('submit button');
console.log(button);
```

This outputs all element properties:

```javascript
{
  description: 'submit button',
  found: true,
  x: 150,
  y: 300,
  coordinates: { x: 150, y: 300, centerX: 200, centerY: 320 },
  threshold: 0.8,
  confidence: 0.95,
  similarity: 0.92,
  selector: 'button[type="submit"]',
  cache: {
    hit: true,
    strategy: 'pixel-diff',
    createdAt: '2025-01-15T10:30:00Z',
    diffPercent: 0.02,
    imageUrl: 'https://...'
  }
}
```

### Working with Multiple Elements

Find and interact with multiple elements:

```javascript
// Find all matching elements
const products = await testdriver.findAll('product card');
console.log(`Found ${products.length} products`);

// Interact with each
for (const product of products) {
  const title = await product.find('title text');
  console.log('Product:', title.text);

  await product.find('add to cart button').click();
}

// Or find specific element
const firstProduct = products[0];
await firstProduct.click();
```

## Making Assertions

Use AI-powered assertions to verify application state. TestDriver acts as a judge: it evaluates your natural-language statement against the current state of the app and returns a boolean plus reasoning explaining the verdict.

```javascript
// Verify visibility
await testdriver.assert('login page is displayed');
await testdriver.assert('submit button is visible');
await testdriver.assert('loading spinner is not visible');

// Verify content
await testdriver.assert('page title is "Welcome"');
await testdriver.assert('success message says "Account created"');
await testdriver.assert('error message contains "Invalid email"');

// Verify state
await testdriver.assert('checkbox is checked');
await testdriver.assert('dropdown shows "United States"');
await testdriver.assert('button is disabled');

// Verify visual appearance
await testdriver.assert('submit button is blue');
await testdriver.assert('form has red border');
```

<Info>Assertions are not cached and always re-evaluated to ensure accuracy.</Info>

## Next

<Card title="Adapt" icon="arrows-rotate" href="/v7/performing-actions">
  Drive your app forward by performing actions on the elements you've located and validated.
</Card>
