# TestDriver SDK Acceptance Tests

This directory contains all acceptance tests from `testdriver/acceptance` converted to use the TestDriver SDK format.

## Overview

These tests demonstrate how to use the TestDriver SDK to perform various UI automation tasks. Each test file corresponds to a YAML test file from the `testdriver/acceptance` directory.

## Prerequisites

- Node.js installed
- TestDriver API key set in `TD_API_KEY` environment variable
- TestDriver SDK installed (`npm install testdriverai` or use from parent directory)

## Usage

Run any test with:

```bash
export TD_API_KEY=your_api_key_here
node testdriver/acceptance-sdk/[test-name].js
```

Or make them executable:

```bash
chmod +x testdriver/acceptance-sdk/*.js
./testdriver/acceptance-sdk/[test-name].js
```

## Test Files

### Basic Interaction Tests
- **assert.js** - Basic assertion test
- **type.js** - Text input and form validation
- **hover-text.js** - Hovering and clicking text elements
- **press-keys.js** - Keyboard shortcuts and key combinations
- **hover-text-with-description.js** - Hover text with descriptive context

### Scroll Tests
- **scroll.js** - Mouse-based scrolling
- **scroll-keyboard.js** - Keyboard-based scrolling
- **scroll-until-text.js** - Scroll until specific text appears
- **scroll-until-image.js** - Scroll until specific image appears

### Code Execution Tests
- **exec-js.js** - Execute JavaScript code in sandbox
- **exec-shell.js** - Execute PowerShell commands
- **exec-output.js** - Use exec output in subsequent commands

### Image & AI Tests
- **hover-image.js** - Hover and click on images
- **match-image.js** - Template matching with images
- **remember.js** - AI-powered information extraction

### Advanced Tests
- **if-else.js** - Conditional logic using try-catch
- **drag-and-drop.js** - Drag and drop operations
- **focus-window.js** - Application window focus management
- **embed.js** - Running reusable test snippets
- **dashcam.js** - Simple test for dashcam recording
- **prompt.js** - AI-driven prompts (requires explicit SDK calls)

## Conversion Notes

### If-Else Logic
The YAML format supports native `if-else` commands. In the SDK, this is implemented using try-catch blocks:

```javascript
try {
  await client.assert('condition is true');
  // then branch
} catch {
  // else branch
}
```

### Reusable Snippets
YAML tests use `run: file: snippets/login.yaml` for reusable flows. In the SDK, create reusable functions:

```javascript
async function performLogin(client) {
  await client.hoverText('Username', 'username field', 'click');
  await client.type('standard_user');
  // ... more login steps
}

// Then use it:
await performLogin(client);
```

### Output Variables
YAML uses `output: variableName` and `${OUTPUT.variableName}`. In the SDK, use regular JavaScript variables:

```javascript
const email = await client.exec('js', 'result = fetchEmail();', 10000);
await client.type(email); // Use the variable directly
```

### Method Mapping

| YAML Command | SDK Method |
|--------------|------------|
| `command: assert` | `client.assert()` |
| `command: type` | `client.type()` |
| `command: hover-text` | `client.hoverText()` |
| `command: hover-image` | `client.hoverImage()` |
| `command: press-keys` | `client.pressKeys()` |
| `command: scroll` | `client.scroll()` |
| `command: scroll-until-text` | `client.scrollUntilText()` |
| `command: scroll-until-image` | `client.scrollUntilImage()` |
| `command: wait-for-text` | `client.waitForText()` |
| `command: wait-for-image` | `client.waitForImage()` |
| `command: wait` | `client.wait()` |
| `command: exec` | `client.exec()` |
| `command: remember` | `client.remember()` |
| `command: focus-application` | `client.focusApplication()` |
| `command: match-image` | `client.matchImage()` |

## Common Patterns

### Basic Test Structure

```javascript
const TestDriver = require('../../sdk');

async function main() {
  const client = new TestDriver(process.env.TD_API_KEY, {
    resolution: '1366x768',
    analytics: true,
    logging: true
  });

  try {
    await client.auth();
    await client.connect({ newSandbox: true });
    
    // Your test steps here
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    await client.disconnect();
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

### Event Handling

```javascript
const emitter = client.getEmitter();

emitter.on('**', (event, data) => {
  console.log(`[Event] ${event?.type}`, data || '');
});
```

## Known Limitations

1. **Prompt-only tests**: The `prompt.yaml` test uses AI prompts without explicit commands. The SDK requires explicit method calls.

2. **Snippet embedding**: Tests that use `run: file: snippets/xxx.yaml` need to have those flows implemented as JavaScript functions.

3. **Match-image paths**: Tests using `match-image` need image file paths which aren't specified in the original YAML files.

## Contributing

When adding new tests:
1. Follow the existing naming convention
2. Add comprehensive console logging
3. Include error handling
4. Add documentation comments at the top
5. Update this README with the new test

## Related Files

- Original YAML tests: `testdriver/acceptance/`
- SDK example: `examples/sdk-example.js`
- SDK definition: `sdk.js`
- SDK TypeScript types: `sdk.d.ts`
