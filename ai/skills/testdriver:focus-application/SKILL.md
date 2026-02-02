---
name: testdriver:focus-application
description: Bring an application window to the foreground
---
<!-- Generated from focus-application.mdx. DO NOT EDIT. -->

## Overview

Bring a specific application window to the foreground and make it the active window for interactions.

## Syntax

```javascript
await testdriver.focusApplication(name)
```

## Parameters

<ParamField path="name" type="string" required>
  Application name (e.g., `'Google Chrome'`, `'Microsoft Edge'`, `'Notepad'`)
</ParamField>

## Returns

`Promise<string>` - Result message

## Examples

### Common Applications

```javascript
// Focus Chrome browser
await testdriver.focusApplication('Google Chrome');

// Focus Edge browser
await testdriver.focusApplication('Microsoft Edge');

// Focus Notepad
await testdriver.focusApplication('Notepad');

// Focus File Explorer
await testdriver.focusApplication('File Explorer');

// Focus Visual Studio Code
await testdriver.focusApplication('Visual Studio Code');
```

### After Opening Applications

```javascript
// Open Chrome and focus it
await testdriver.exec('pwsh', `
  Start-Process "C:/Program Files/Google/Chrome/Application/chrome.exe" -ArgumentList "https://example.com"
`, 5000);

await new Promise(r => setTimeout(r, 2000)); // Wait for launch

// Focus the Chrome window
await testdriver.focusApplication('Google Chrome');
```

## Best Practices

<Check>
  **Focus before UI interactions**
  
  Always focus the target application before interacting with its UI:
  
  ```javascript
  await testdriver.focusApplication('Google Chrome');
  
  const button = await testdriver.find('submit button');
  await button.click();
  ```
</Check>

<Check>
  **Wait after launching apps**
  
  Give applications time to open before focusing:
  
  ```javascript
  await testdriver.exec('pwsh', 'Start-Process notepad', 5000);
  await new Promise(r => setTimeout(r, 1000)); // Wait for launch
  await testdriver.focusApplication('Notepad');
  ```
</Check>

<Check>
  **Use exact application names**
  
  ```javascript
  // ✅ Correct
  await testdriver.focusApplication('Google Chrome');
  
  // ❌ May not work
  await testdriver.focusApplication('Chrome');
  await testdriver.focusApplication('chrome.exe');
  ```
</Check>

<Warning>
  **Application must be running**
  
  The application must already be running. `focusApplication()` won't launch applications, only bring existing windows to the foreground.
</Warning>

## Use Cases

<AccordionGroup>
  <Accordion title="Multi-Application Testing">
    ```javascript
    // Test workflow across multiple apps
    await testdriver.focusApplication('Google Chrome');
    const data = await testdriver.extract('the order number');
    
    await testdriver.focusApplication('Notepad');
    await testdriver.type(data);
    await testdriver.pressKeys(['ctrl', 's']);
    
    await testdriver.focusApplication('Google Chrome');
    const nextButton = await testdriver.find('next button');
    await nextButton.click();
    ```
  </Accordion>
  
  <Accordion title="Browser Switching">
    ```javascript
    // Compare behavior in different browsers
    await testdriver.focusApplication('Google Chrome');
    await testdriver.assert('page loaded correctly in Chrome');
    
    await testdriver.focusApplication('Microsoft Edge');
    await testdriver.assert('page loaded correctly in Edge');
    ```
  </Accordion>
  
  <Accordion title="Desktop Application Testing">
    ```javascript
    // Launch and focus desktop app
    await testdriver.exec('pwsh', 'Start-Process notepad', 5000);
    await new Promise(r => setTimeout(r, 1000));
    
    await testdriver.focusApplication('Notepad');
    await testdriver.type('Test content');
    ```
  </Accordion>
  
  <Accordion title="Window Management">
    ```javascript
    // Show desktop first
    await testdriver.pressKeys(['winleft', 'd']);
    
    // Click desktop icon
    const icon = await testdriver.find('Chrome icon on desktop');
    await icon.click();
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Focus the opened window
    await testdriver.focusApplication('Google Chrome');
    ```
  </Accordion>
</AccordionGroup>

## Common Application Names

### Browsers
- `'Google Chrome'`
- `'Microsoft Edge'`
- `'Mozilla Firefox'`
- `'Safari'` (macOS)

### Office Applications
- `'Microsoft Word'`
- `'Microsoft Excel'`
- `'Microsoft PowerPoint'`
- `'Microsoft Outlook'`

### Development Tools
- `'Visual Studio Code'`
- `'Visual Studio'`
- `'IntelliJ IDEA'`
- `'Sublime Text'`

### System Applications
- `'Notepad'`
- `'File Explorer'`
- `'Command Prompt'`
- `'Windows PowerShell'`
- `'Task Manager'`

### Communication
- `'Microsoft Teams'`
- `'Slack'`
- `'Discord'`
- `'Zoom'`

## Complete Example

```javascript
import { beforeAll, afterAll, describe, it } from 'vitest';
import TestDriver from 'testdriverai';

describe('Multi-Application Workflow', () => {
  let testdriver;

  beforeAll(async () => {
    client = new TestDriver(process.env.TD_API_KEY);
    await testdriver.auth();
    await testdriver.connect();
  });

  afterAll(async () => {
    await testdriver.disconnect();
  });

  it('should work across multiple applications', async () => {
    // Start in browser
    await testdriver.focusApplication('Google Chrome');
    
    // Get data from web page
    const orderNumber = await testdriver.extract('the order number');
    console.log('Order:', orderNumber);
    
    // Open Notepad
    await testdriver.exec('pwsh', 'Start-Process notepad', 5000);
    await new Promise(r => setTimeout(r, 1500));
    
    // Focus Notepad and save data
    await testdriver.focusApplication('Notepad');
    await testdriver.type(`Order Number: ${orderNumber}`);
    await testdriver.type('\n');
    await testdriver.type(`Date: ${new Date().toISOString()}`);
    
    // Save file
    await testdriver.pressKeys(['ctrl', 's']);
    await new Promise(r => setTimeout(r, 500));
    
    await testdriver.type('C:\\order-info.txt');
    await testdriver.pressKeys(['enter']);
    
    // Return to browser
    await testdriver.focusApplication('Google Chrome');
    
    const confirmButton = await testdriver.find('confirm order button');
    await confirmButton.click();
    
    await testdriver.assert('order confirmed');
  });

  it('should switch between browser tabs', async () => {
    await testdriver.focusApplication('Google Chrome');
    
    // Open new tab
    await testdriver.pressKeys(['ctrl', 't']);
    await new Promise(r => setTimeout(r, 500));
    
    // Navigate to URL
    await testdriver.pressKeys(['ctrl', 'l']);
    await testdriver.type('https://example.com');
    await testdriver.pressKeys(['enter']);
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Ensure Chrome is still focused
    await testdriver.focusApplication('Google Chrome');
    
    await testdriver.assert('example.com page is loaded');
  });

  it('should handle dialog boxes', async () => {
    await testdriver.focusApplication('Google Chrome');
    
    const deleteButton = await testdriver.find('delete account button');
    await deleteButton.click();
    
    await new Promise(r => setTimeout(r, 500));
    
    // Dialog appears - make sure it's focused
    await testdriver.focusApplication('Google Chrome');
    
    const confirmBtn = await testdriver.find('confirm deletion button');
    await confirmBtn.click();
  });
});
```

## Related Methods

- [`exec()`](/v7/exec) - Launch applications with PowerShell
- [`pressKeys()`](/v7/press-keys) - Use Alt+Tab to switch windows
- [`find()`](/v7/find) - Locate elements in the focused window
