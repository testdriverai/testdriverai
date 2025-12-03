# Dashcam Recording Titles

## Overview

Dashcam recordings now automatically use meaningful titles instead of the generic "Dashcam Recording" label.

## Automatic Title Generation

When using TestDriver with Vitest, the dashcam recording title is automatically generated from:
1. **Test file name** - Extracted from the test file path
2. **Test name** - The name of the test case

### Example

For a test file `login.test.mjs` with test case `"should login successfully"`:
```
Recording title: "login - should login successfully"
```

For standalone usage without test context:
```
Recording title: "Recording 2025-12-02 14:30:45"
```

## Custom Titles

You can set a custom title before starting the dashcam recording:

### With Vitest Integration

```javascript
import { test } from 'vitest';
import { TestDriver } from 'testdriverai/vitest';

test('my test', async (context) => {
  const testdriver = TestDriver(context, { headless: true });
  
  // Set custom title before dashcam starts
  testdriver.dashcam.setTitle('My Custom Recording Title');
  
  // Start recording (provision methods start dashcam automatically)
  await testdriver.provision.chrome({ url: 'https://example.com' });
  
  await testdriver.find('button').click();
});
```

### Direct SDK Usage

```javascript
const TestDriver = require('testdriverai');

const client = new TestDriver(process.env.TD_API_KEY);
await client.connect();

// Set custom title
client.dashcam.setTitle('Integration Test - Payment Flow');

// Start recording
await client.dashcam.start();

await client.provision.chrome({ url: 'https://example.com' });
await client.find('Checkout button').click();

// Stop recording and get URL
const dashcamUrl = await client.dashcam.stop();
console.log('Recording:', dashcamUrl);
```

## Constructor Option

You can also pass a title when creating the Dashcam instance:

```javascript
const { Dashcam } = require('testdriverai/core');

const dashcam = new Dashcam(client, {
  title: 'Custom Title',
  autoStart: true
});
```

## Implementation Details

- **Default title generation** uses test context (`__vitestContext`) when available
- **Test file names** are cleaned (removes `.test`, `.spec`, file extensions)
- **Fallback** to ISO timestamp if no test context is available
- **Title escaping** handles special characters in shell commands properly
- **Cross-platform** support for Windows (PowerShell) and Linux/Mac (bash/zsh)
