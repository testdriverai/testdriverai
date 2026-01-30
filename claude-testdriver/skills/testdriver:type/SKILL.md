---
name: testdriver:type
description: Type text into focused input fields
---
<!-- Generated from type.mdx. DO NOT EDIT. -->

## Overview

Type text or numbers into the currently focused input field with optional delay between keystrokes.

## Syntax

```javascript
await testdriver.type(text, options)
```

## Parameters

<ParamField path="text" type="string | number" required>
  Text to type (can be a string or number)
</ParamField>

<ParamField path="options" type="object | number">
  Typing options (or legacy delay number)
  
  <Expandable title="properties">
    <ParamField path="delay" type="number" default={250}>
      Delay between keystrokes in milliseconds
    </ParamField>
    
    <ParamField path="secret" type="boolean" default={false}>
      If `true`, treats text as sensitive data (won't be logged or stored in debug info/dashcam)
    </ParamField>
  </Expandable>
</ParamField>

## Returns

`Promise<void>`

## Examples

### Basic Typing

```javascript
// Type text
await testdriver.type('hello@example.com');

// Type numbers
await testdriver.type(12345);

// Type with custom delay (legacy syntax)
await testdriver.type('slow typing', 500); // 500ms between each character

// Type with options object
await testdriver.type('text', { delay: 500 });
```

### Password/Secret Handling

```javascript
// ✅ SECURE - Mark as secret to prevent logging
const passwordField = await testdriver.find('password input');
await passwordField.click();
await testdriver.type('MySecureP@ssw0rd', { secret: true });
// Password NOT logged in dashcam or debug output

// ❌ INSECURE - Password will be logged
await testdriver.type('MySecureP@ssw0rd');
// Password appears in logs, dashcam replay, and debug info

// Use secret for any sensitive data
await testdriver.find('api key input').click();
await testdriver.type('sk-1234567890abcdef', { secret: true });

await testdriver.find('credit card input').click();
await testdriver.type('4111111111111111', { secret: true });
```

<Warning>
  **Always use `secret: true` for passwords and sensitive data!**
  
  Without this option, typed text appears in:
  - Dashcam video replays
  - TestDriver logs
  - Debug screenshots
  - Error messages
</Warning>

### Form Filling

```javascript
// Focus field and type
const emailField = await testdriver.find('email input');
await emailField.click();
await testdriver.type('user@example.com');

// Tab to next field and type
await testdriver.pressKeys(['tab']);
await testdriver.type('John Doe');

// Type password securely
await testdriver.pressKeys(['tab']);
await testdriver.type('MySecureP@ssw0rd', { secret: true });
```

### Clearing and Replacing Text

```javascript
const searchBox = await testdriver.find('search input');
await searchBox.click();

// Clear existing text
await testdriver.pressKeys(['ctrl', 'a']); // Select all
await testdriver.type('new search query');
```

## Best Practices

<Check>
  **Focus the field first**
  
  Always click the input field or navigate to it before typing:
  
  ```javascript
  const input = await testdriver.find('username input');
  await input.click();
  await testdriver.type('testuser');
  ```
</Check>

<Check>
  **Use Tab for navigation**
  
  Navigate between fields using Tab instead of clicking each one:
  
  ```javascript
  const firstField = await testdriver.find('first name');
  await firstField.click();
  await testdriver.type('John');
  
  await testdriver.pressKeys(['tab']);
  await testdriver.type('Doe');
  
  await testdriver.pressKeys(['tab']);
  await testdriver.type('john@example.com');
  ```
</Check>

<Check>
  **Clear fields before typing**
  
  Clear existing content to avoid appending:
  
  ```javascript
  const input = await testdriver.find('search field');
  await input.click();
  await testdriver.pressKeys(['ctrl', 'a']); // Select all
  await testdriver.type('new search');
  ```
</Check>

<Warning>
  **Field must be focused**
  
  Typing will only work if an input field is currently focused. If no field is focused, the text may be lost or trigger unexpected keyboard shortcuts.
</Warning>

## Use Cases

<AccordionGroup>
  <Accordion title="Login Forms">
    ```javascript
    await testdriver.focusApplication('Google Chrome');
    
    const usernameField = await testdriver.find('username input');
    await usernameField.click();
    await testdriver.type('testuser@example.com');
    
    await testdriver.pressKeys(['tab']);
    await testdriver.type('MyP@ssword123', { secret: true });
    
    await testdriver.pressKeys(['enter']);
    ```
  </Accordion>
  
  <Accordion title="Search Fields">
    ```javascript
    const searchBox = await testdriver.find('search input');
    await searchBox.click();
    await testdriver.type('laptop computers');
    await testdriver.pressKeys(['enter']);
    
    // Wait for results
    await new Promise(r => setTimeout(r, 2000));
    ```
  </Accordion>
  
  <Accordion title="Multi-Field Forms">
    ```javascript
    // First field
    const nameField = await testdriver.find('full name input');
    await nameField.click();
    await testdriver.type('Jane Smith');
    
    // Navigate with Tab
    await testdriver.pressKeys(['tab']);
    await testdriver.type('jane.smith@example.com');
    
    await testdriver.pressKeys(['tab']);
    await testdriver.type('+1-555-0123');
    
    await testdriver.pressKeys(['tab']);
    await testdriver.type('123 Main Street');
    ```
  </Accordion>
  
  <Accordion title="Text Editors">
    ```javascript
    const editor = await testdriver.find('text editor area');
    await editor.click();
    
    await testdriver.type('# My Document', 100);
    await testdriver.pressKeys(['enter', 'enter']);
    await testdriver.type('This is the first paragraph.', 50);
    ```
  </Accordion>
  
  <Accordion title="Numeric Input">
    ```javascript
    const quantityField = await testdriver.find('quantity input');
    await quantityField.click();
    
    // Clear field
    await testdriver.pressKeys(['ctrl', 'a']);
    
    // Type number
    await testdriver.type(5);
    ```
  </Accordion>
</AccordionGroup>

## Typing Speed

Adjust the delay parameter based on your needs:

```javascript
// Fast typing (100ms delay)
await testdriver.type('quick entry', 100);

// Normal typing (250ms - default)
await testdriver.type('standard speed');

// Slow typing (500ms delay) - useful for fields with live validation
await testdriver.type('slow and steady', 500);

// Very slow (1000ms delay) - for problematic fields
await testdriver.type('one by one', 1000);
```

<Note>
  Some applications with live validation or autocomplete may require slower typing speeds to avoid race conditions.
</Note>

## Special Characters

```javascript
// Email addresses
await testdriver.type('user@example.com');

// URLs
await testdriver.type('https://example.com/path?query=value');

// Passwords with special characters
await testdriver.type('P@ssw0rd!#$%');

// Paths
await testdriver.type('C:\\Users\\Documents\\file.txt');

// Multi-line text (use pressKeys for Enter)
await testdriver.type('Line 1');
await testdriver.pressKeys(['enter']);
await testdriver.type('Line 2');
```

## Complete Example

```javascript
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import TestDriver from 'testdriverai';

describe('Form Filling with Type', () => {
  let testdriver;

  beforeAll(async () => {
    client = new TestDriver(process.env.TD_API_KEY);
    await testdriver.auth();
    await testdriver.connect();
  });

  afterAll(async () => {
    await testdriver.disconnect();
  });

  it('should fill out registration form', async () => {
    await testdriver.focusApplication('Google Chrome');
    
    // Email field
    const emailField = await testdriver.find('email input field');
    await emailField.click();
    await testdriver.type('john.doe@example.com');
    
    // Tab through form fields
    await testdriver.pressKeys(['tab']);
    await testdriver.type('John');
    
    await testdriver.pressKeys(['tab']);
    await testdriver.type('Doe');
    
    await testdriver.pressKeys(['tab']);
    await testdriver.type('MySecureP@ssword123');
    
    await testdriver.pressKeys(['tab']);
    await testdriver.type('MySecureP@ssword123'); // Confirm password
    
    // Verify fields were filled
    const result = await testdriver.assert('all form fields are filled');
    expect(result).toBeTruthy();
  });

  it('should update search query', async () => {
    const searchBox = await testdriver.find('search input');
    await searchBox.click();
    
    // Type initial search
    await testdriver.type('laptops');
    await testdriver.pressKeys(['enter']);
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Update search
    await searchBox.click();
    await testdriver.pressKeys(['ctrl', 'a']); // Select all
    await testdriver.type('gaming laptops');
    await testdriver.pressKeys(['enter']);
    
    // Verify new search
    await testdriver.assert('search results for "gaming laptops" are shown');
  });
});
```

## Related Methods

- [`pressKeys()`](/v7/press-keys) - Press keyboard keys and shortcuts
- [`find()`](/v7/find) - Locate input fields
- [`click()`](/v7/click) - Focus input fields
