#!/usr/bin/env node

/**
 * TestDriver SDK - Logging Example
 * 
 * This example demonstrates how to use the SDK's logging and event system.
 */

const TestDriver = require('../sdk');

async function main() {
  // Initialize SDK with logging enabled (default)
  const client = new TestDriver(process.env.TD_API_KEY, {
    logging: true  // This is the default, shows all logs
  });

  // Get the event emitter for custom event handling
  const emitter = client.getEmitter();

  console.log('=== SDK Logging Example ===\n');

  // Example 1: Listen to all log events
  console.log('1. Setting up event listeners...\n');
  
  emitter.on('log:narration', (message) => {
    console.log('  [Narration]', message);
  });

  emitter.on('command:start', (data) => {
    console.log(`  [Command Start] ${data.command}`);
  });

  emitter.on('command:success', (data) => {
    console.log(`  [Command Success] ${data.command} (${data.duration}ms)`);
  });

  // Example 2: Track performance
  const performanceTracker = new Map();
  
  emitter.on('command:start', (data) => {
    performanceTracker.set(data.command, {
      startTime: Date.now(),
      timestamp: data.timestamp
    });
  });

  emitter.on('command:success', (data) => {
    const tracked = performanceTracker.get(data.command);
    if (tracked) {
      const totalTime = Date.now() - tracked.startTime;
      console.log(`  ⏱️  Performance: ${data.command} took ${totalTime}ms total`);
    }
  });

  // Example 3: Disable/enable logging dynamically
  console.log('\n2. Testing dynamic logging control...\n');
  
  try {
    await client.auth();
    await client.connect({ newSandbox: true });

    console.log('\n3. Running commands with logging enabled...\n');
    await client.focusApplication('Google Chrome');
    await client.wait(1000);

    console.log('\n4. Disabling default logging...\n');
    client.setLogging(false);
    
    console.log('  (Default console output is now disabled)');
    console.log('  (But our custom event listeners still work!)\n');
    
    await client.wait(1000);
    await client.scroll('down', 300);

    console.log('\n5. Re-enabling logging...\n');
    client.setLogging(true);
    
    await client.scroll('up', 300);

    // Example 4: Error handling
    console.log('\n6. Testing error handling...\n');
    
    emitter.on('error:*', (data) => {
      console.error('  [Error Detected]', data);
    });

    try {
      // This might fail if text doesn't exist
      await client.waitForText('This probably does not exist', 2000);
    } catch (error) {
      console.log('  Caught expected error:', error.message);
    }

    console.log('\n✅ Logging example completed successfully!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.disconnect();
  }

  // Display performance summary
  console.log('\n=== Performance Summary ===');
  for (const [command, data] of performanceTracker) {
    console.log(`  ${command}: started at ${new Date(data.timestamp).toISOString()}`);
  }
}

// Run the example
if (require.main === module) {
  if (!process.env.TD_API_KEY) {
    console.error('Error: TD_API_KEY environment variable is required');
    console.log('Usage: TD_API_KEY=your-key node logging-example.js');
    process.exit(1);
  }

  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = main;
