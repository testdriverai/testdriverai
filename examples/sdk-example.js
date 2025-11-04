#!/usr/bin/env node

/**
 * TestDriver SDK Example
 * 
 * This example demonstrates how to use the TestDriver SDK to automate UI testing.
 * 
 * Prerequisites:
 * - Set TD_API_KEY environment variable
 * - Install testdriverai: npm install testdriverai
 * 
 * Usage:
 * node examples/sdk-example.js
 */

const TestDriver = require('../sdk');

async function main() {
  // Initialize the SDK with your API key
  const client = new TestDriver(process.env.TD_API_KEY, {
    // Optional configuration
    resolution: '1366x768',
    analytics: true,
    // Enable logging to see detailed output (enabled by default)
    logging: true
  });

  const emitter = client.getEmitter();

  emitter.on('**', (event, data) => {
    console.log(event)
    console.log(`[Event] ${event?.type}`, data || '');
  });

  try {
    console.log('🔐 Authenticating...');
    await client.auth();

    console.log('🔌 Connecting to sandbox...');
    await client.connect({
      // Optional: reconnect to existing sandbox
      // sandboxId: 'your-sandbox-id',
      
      // Optional: force new sandbox creation
      newSandbox: true
    });

    console.log('✅ Connected!');
    console.log('Sandbox instance:', client.getInstance());

    // Example 1: Navigate and interact with text
    console.log('\n📝 Example 1: Finding and clicking text...');
    await client.focusApplication('Google Chrome');
    await client.wait(2000);
    
    // Type in a search box (assuming one is focused)
    await client.type('testdriver.ai', 100);
    await client.pressKeys(['enter']);
    await client.wait(3000);

    // Example 2: Wait for text to appear
    console.log('\n⏳ Example 2: Waiting for text...');
    await client.waitForText('TestDriver', 10000);
    console.log('✅ Found "TestDriver" on screen!');

    // Example 3: Hover over text and click
    console.log('\n🖱️  Example 3: Hovering over text...');
    const result = await client.hoverText('Search', null, 'click');
    console.log('Hover result:', result);

    // Example 4: Scroll the page
    console.log('\n📜 Example 4: Scrolling...');
    await client.scroll('down', 500);
    await client.wait(1000);
    await client.scroll('up', 500);

    // Example 5: Make an assertion
    console.log('\n✔️  Example 5: Making assertion...');
    try {
      await client.assert('The page title contains "Test"');
      console.log('✅ Assertion passed!');
    } catch (error) {
      console.log('❌ Assertion failed:', error.message);
    }

    // Example 6: Remember information
    console.log('\n🧠 Example 6: Remembering information...');
    const rememberedInfo = await client.remember('What is the main heading on this page?');
    console.log('Remembered:', rememberedInfo);

    // Example 7: Execute code
    console.log('\n💻 Example 7: Executing code...');
    const execResult = await client.exec('js', `
      result = { message: 'Hello from executed code!', timestamp: Date.now() };
    `, 5000);
    console.log('Execution result:', execResult);

    console.log('\n🎉 All examples completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    // Clean up
    console.log('\n🧹 Disconnecting...');
    await client.disconnect();
    console.log('👋 Done!');
    process.exit(0);
  }
}

// Run the example
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
