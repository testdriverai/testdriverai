---
name: assertions
description: Make assertions in TestDriver tests. Use when verifying UI state, checking visual conditions, or validating test outcomes with natural language.
---

# Making Assertions

Read: `node_modules/testdriverai/docs/v7/assert.mdx`
Read: `node_modules/testdriverai/docs/v7/making-assertions.mdx`

## Basic Usage

```javascript
const result = await testdriver.assert("the dashboard is visible");
expect(result).toBeTruthy();
```

## Writing Good Assertions

**Be specific:**
```javascript
// ✅ Good
await testdriver.assert("the login button is visible in the header");
await testdriver.assert("user's name 'John' appears in the profile section");
await testdriver.assert("error message 'Invalid email' is displayed");

// ❌ Vague
await testdriver.assert("button visible");
await testdriver.assert("it worked");
```

**Describe what you see:**
```javascript
await testdriver.assert("the settings panel is open on the right side");
await testdriver.assert("a green success checkmark appears next to the form");
await testdriver.assert("the page shows 'Welcome back, John'");
```

**Include context:**
```javascript
await testdriver.assert("the shopping cart shows 3 items");
await testdriver.assert("the price total is $99.99");
await testdriver.assert("the submit button is disabled");
```

## Common Patterns

### After navigation
```javascript
await testdriver.find("Settings link").click();
const result = await testdriver.assert("Settings page is displayed");
expect(result).toBeTruthy();
```

### Form validation
```javascript
await testdriver.find("Submit button").click();
const hasError = await testdriver.assert("email validation error is shown");
expect(hasError).toBeTruthy();
```

### State changes
```javascript
await testdriver.find("Toggle switch").click();
const isOn = await testdriver.assert("the toggle is now in the ON position");
expect(isOn).toBeTruthy();
```

### Negative assertions
```javascript
const noError = await testdriver.assert("no error messages are visible");
expect(noError).toBeTruthy();
```

## Examples

See `node_modules/testdriverai/examples/assert.test.mjs`
