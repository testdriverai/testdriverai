#!/usr/bin/env node

/**
 * Type Checking Demo
 * 
 * This file demonstrates the strict type checking and autocomplete features
 * of the TestDriver SDK. Open this file in VS Code and notice:
 * 
 * 1. Method autocomplete when you type `client.`
 * 2. Parameter autocomplete for enum values like action, direction, method
 * 3. Inline documentation showing parameter types and descriptions
 * 4. Type warnings if you use invalid values
 */

const TestDriver = require('../../sdk.js');

async function typeCheckingDemo() {
  const client = new TestDriver(process.env.TD_API_KEY);
  
  await client.auth();
  await client.connect();

  // Try typing these and see the autocomplete:
  
  // 1. Action parameter - should autocomplete: 'click', 'right-click', 'double-click', 'hover', 'drag-start', 'drag-end'
  await client.hoverText('Submit', null, 'click');
  
  // 2. Scroll direction - should autocomplete: 'up', 'down', 'left', 'right'
  await client.scroll('asdf', 300, 'keyboard');
  
  // 3. Text match method - should autocomplete: 'ai', 'turbo'
  await client.waitForText('Welcome', 5000, 'turbo');
  
  // 4. Keyboard keys - should autocomplete all valid keys
  await client.pressKeys(['enter', 'tab', 'escape']);
  
  // 5. Exec language - should autocomplete: 'js', 'pwsh'
  await client.exec('js', 'console.log("Hello")', 5000);
  
  // 6. Scroll method - should autocomplete: 'keyboard', 'mouse'
  await client.scrollUntilText('Contact', 'down', 10000, 'turbo', 'keyboard');

  await client.disconnect();
}

// Uncomment to run:
// typeCheckingDemo().catch(console.error);

module.exports = typeCheckingDemo;
