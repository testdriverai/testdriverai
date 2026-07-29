---
name: testdriver:extract
description: Read information from the screen using AI and return it as a string
---
<!-- Generated from extract.mdx. DO NOT EDIT. -->

## Overview

Extract information from the current screen using AI and return it as a string. Describe what you want in natural language, and the AI reads the screen and returns the matching value — text, numbers, labels, status messages, or any other on-screen content.

Unlike [`assert()`](/v7/assert), which returns a boolean verdict, `extract()` returns the actual value so you can store it, compare it, or feed it into later steps and framework assertions.

## Syntax

```javascript
const value = await testdriver.extract(description)
const value = await testdriver.extract({ description })
```

## Parameters

<ParamField path="description" type="string" required>
  Natural language description of the information to read from the screen.
</ParamField>

<Info>
  `extract()` also accepts an options object — `extract({ description })` — which is equivalent to the positional form. The bare string form is the most common.
</Info>

## Returns

`Promise<string>` — The information read from the screen. Returns the extracted value as text; parse or cast it yourself if you need a number or other type.

## Examples

### Basic Extraction

```javascript
// Read text content
const title = await testdriver.extract('the page title');
const heading = await testdriver.extract('the main heading text');

// Read numbers and prices
const price = await testdriver.extract('the total price shown in the cart');
const count = await testdriver.extract('the number of items in the list');

// Read status and confirmation values
const status = await testdriver.extract('the order status');
const orderNumber = await testdriver.extract('the order confirmation number');
```

### Using the Extracted Value

```javascript
// Store and reuse across steps
const orderNumber = await testdriver.extract('the order confirmation number');
console.log('Order:', orderNumber);

// Combine with framework assertions
import { expect } from 'vitest';

const message = await testdriver.extract('the success message text');
expect(message).toContain('successfully');

// Cast to a number when you need to compare
const totalText = await testdriver.extract('the cart total as a number without currency symbol');
expect(Number(totalText)).toBeGreaterThan(0);
```

## Best Practices

<Check>
  **Be specific about what to read**

  Precise descriptions produce cleaner values:

  ```javascript
  // ❌ Too vague — may return extra surrounding text
  const price = await testdriver.extract('price');

  // ✅ Specific — targets a single value
  const price = await testdriver.extract('the total price in the order summary, digits only');
  ```
</Check>

<Check>
  **Ask for the format you want**

  Steer the output by describing the desired shape in the prompt:

  ```javascript
  // Strip currency symbols
  const total = await testdriver.extract('the order total as a number without the dollar sign');

  // Isolate a single field
  const email = await testdriver.extract('the email address shown in the profile header');
  ```
</Check>

<Check>
  **Extract for detailed assertions**

  Use `extract()` when a boolean [`assert()`](/v7/assert) isn't enough and you need the actual value to inspect:

  ```javascript
  const confirmation = await testdriver.extract('the confirmation number');
  expect(confirmation).toMatch(/^ORD-\d{6}$/);
  ```
</Check>

## Use Cases

<AccordionGroup>
  <Accordion title="Capturing Confirmation Details">
    ```javascript
    const submitBtn = await testdriver.find('place order button');
    await submitBtn.click();

    // Read the confirmation the app generated
    const orderNumber = await testdriver.extract('the order confirmation number');
    const eta = await testdriver.extract('the estimated delivery date');

    console.log(`Order ${orderNumber} arrives ${eta}`);
    ```
  </Accordion>

  <Accordion title="Reading Tooltip and Hover Content">
    ```javascript
    const icon = await testdriver.find('info icon next to the price');
    await icon.hover();

    const tooltipText = await testdriver.extract('the tooltip text');
    expect(tooltipText).toContain('tax included');
    ```
  </Accordion>

  <Accordion title="Verifying Dynamic Values">
    ```javascript
    // Read a value before an action
    const before = await testdriver.extract('the account balance');

    const addBtn = await testdriver.find('add funds button');
    await addBtn.click();

    // Read it again after and compare
    const after = await testdriver.extract('the account balance');
    expect(Number(after.replace(/[^0-9.]/g, ''))).toBeGreaterThan(
      Number(before.replace(/[^0-9.]/g, ''))
    );
    ```
  </Accordion>

  <Accordion title="Passing Data Between Steps">
    ```javascript
    // Read a generated code on one screen...
    const resetCode = await testdriver.extract('the password reset code');

    // ...and type it into the next
    const codeField = await testdriver.find('reset code input');
    await codeField.click();
    await testdriver.type(resetCode);
    ```
  </Accordion>
</AccordionGroup>

## Complete Example

```javascript
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import TestDriver from 'testdriverai';

describe('Extraction', () => {
  let testdriver;

  beforeAll(async () => {
    testdriver = new TestDriver(process.env.TD_API_KEY);
    await testdriver.auth();
    await testdriver.connect();
  });

  afterAll(async () => {
    await testdriver.disconnect();
  });

  it('should capture the order confirmation', async () => {
    await testdriver.focusApplication('Google Chrome');

    // Complete a checkout
    const checkoutBtn = await testdriver.find('checkout button');
    await checkoutBtn.click();

    const placeOrderBtn = await testdriver.find('place order button');
    await placeOrderBtn.click();

    // Verify we reached confirmation
    await testdriver.assert('the order confirmation page is displayed');

    // Extract the details the app generated
    const orderNumber = await testdriver.extract('the order confirmation number');
    const total = await testdriver.extract('the order total as a number without currency symbol');

    // Assert on the extracted values
    expect(orderNumber).toBeTruthy();
    expect(Number(total)).toBeGreaterThan(0);
  });
});
```

## How It Works

1. TestDriver captures a screenshot of the current screen
2. The image and your description are sent to the TestDriver API
3. The AI reads the requested information from the screenshot
4. The extracted value is returned as a string

<Note>
  Like [assertions](/v7/making-assertions), `extract()` reads the screen fresh on every call — it is not cached — so it always reflects the current state of the app.
</Note>

## Related Methods

- [`assert()`](/v7/assert) - Verify screen state with a boolean AI judgment
- [`find()`](/v7/find) - Locate elements to interact with
- [`parse()`](/v7/parse) - Detect all UI elements on screen
