#!/usr/bin/env node

/**
 * TestDriver SDK - AWESOME Logs Demo 🎨
 *
 * This example showcases the beautiful, emoji-rich logging with great DX
 * that makes your test output a joy to read!
 *
 * Run: TD_API_KEY=your_key node examples/sdk-awesome-logs-demo.js
 */

const TestDriver = require("../sdk.js");
const { formatter } = require("../sdk-log-formatter.js");

(async () => {
  try {
    console.log(formatter.formatHeader('TestDriver SDK - AWESOME Logs Demo', '🚀'));

    // Create client with logging enabled
    const client = new TestDriver(process.env.TD_API_KEY, {
      os: "windows",
      logging: true,
    });

    // Demo 1: Connection
    console.log(formatter.formatConnection('connect', {
      sandboxId: 'demo-sandbox-123',
      os: 'Windows',
    }));
    
    await client.connect({ headless: true });

    // Demo 2: Navigation
    console.log("\n" + formatter.formatAction('navigate', 'https://example.com'));
    await client.focusApplication("Google Chrome");
    await client.type("https://example.com");
    await client.pressKeys(["enter"]);

    // Demo 3: Wait with loading indicator
    console.log("\n" + formatter.formatWaiting('for page to load', 2000));
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Demo 4: Finding elements (this will use the real formatElementFound from sdk.js)
    console.log("\n" + formatter.formatHeader('Finding Elements', '🔍'));
    
    const heading = await client.find("heading that says Example Domain");
    // The actual find() call will emit the formatted log automatically
    
    if (heading.found()) {
      await heading.click();
      // The click will also emit a formatted log automatically
    }

    // Demo 5: Multiple actions
    console.log("\n" + formatter.formatHeader('User Actions', '👆'));
    
    const link = await client.find("More information link");
    if (link.found()) {
      await link.hover();
      await link.click();
    }

    // Demo 6: Typing
    console.log("\n" + formatter.formatAction('type', 'search query', { 
      text: 'TestDriver AI' 
    }));

    // Demo 7: Scroll
    console.log("\n" + formatter.formatAction('scroll', 'down the page'));
    await client.scroll('down', 300);

    // Demo 8: Assertions
    console.log("\n" + formatter.formatHeader('Assertions', '✅'));
    console.log(formatter.formatAssertion('Page title is correct', true, { 
      duration: '45ms' 
    }));
    console.log(formatter.formatAssertion('Footer is visible', true, { 
      duration: '23ms' 
    }));
    console.log(formatter.formatAssertion('Login button exists', false, { 
      duration: '1234ms' 
    }));

    // Demo 9: Cache status
    console.log("\n" + formatter.formatHeader('Cache Performance', '⚡'));
    console.log(formatter.formatCacheStatus(true, { 
      similarity: 0.98,
      strategy: 'image'
    }));
    console.log(formatter.formatCacheStatus(false, { 
      strategy: 'text' 
    }));

    // Demo 10: Screenshot
    console.log("\n" + formatter.formatScreenshot({ 
      path: '/tmp/testdriver-debug/screenshot-123.png',
      size: '245 KB'
    }));

    // Demo 11: Progress
    console.log("\n" + formatter.formatHeader('Multi-step Process', '📈'));
    for (let i = 1; i <= 5; i++) {
      console.log(formatter.formatProgress(i, 5, `Processing step ${i}`));
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Demo 12: Divider
    console.log("\n" + formatter.formatDivider());

    // Demo 13: Test summary
    console.log(formatter.formatSummary({
      passed: 12,
      failed: 2,
      skipped: 1,
      total: 15,
      duration: '45.23s'
    }));

    // Demo 14: Error handling
    console.log(formatter.formatHeader('Error Examples', '🚨'));
    console.log(formatter.formatError('Element not found', new Error('Timeout after 5000ms')));
    console.log(formatter.formatError('Connection failed', new Error('Network unreachable')));

    // Demo 15: Test lifecycle
    console.log(formatter.formatTestStart('Login Flow Test'));
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log(formatter.formatTestEnd('Login Flow Test', true, 2345));

    console.log(formatter.formatTestStart('Checkout Process'));
    await new Promise((resolve) => setTimeout(resolve, 800));
    console.log(formatter.formatTestEnd('Checkout Process', false, 5678));

    // Final summary
    console.log("\n" + formatter.formatHeader('Demo Complete!', '🎉'));
    console.log("\n✨ Your test logs now look AWESOME! ✨\n");

    await client.disconnect();
    console.log("\n" + formatter.formatConnection('disconnect'));

  } catch (error) {
    console.error(formatter.formatError("Demo failed", error));
    process.exit(1);
  }
})();
