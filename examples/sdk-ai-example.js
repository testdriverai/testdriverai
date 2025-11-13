#!/usr/bin/env node

/**
 * TestDriver SDK - AI Method Example
 * 
 * This example demonstrates how to use the new ai() method,
 * which is the SDK equivalent of the CLI's exploratory loop.
 * 
 * Prerequisites:
 * - Set TD_API_KEY environment variable
 * - Install testdriverai: npm install testdriverai
 * 
 * Usage:
 * TD_API_KEY=your-key node examples/sdk-ai-example.js
 */

const TestDriver = require('../sdk');

async function main() {
  console.log('🤖 TestDriver SDK - AI Method Example\n');

  // Check for API key
  if (!process.env.TD_API_KEY) {
    console.error('Error: TD_API_KEY environment variable is required');
    console.log('Usage: TD_API_KEY=your-key node examples/sdk-ai-example.js');
    process.exit(1);
  }

  // Create a new TestDriver client
  const client = new TestDriver(process.env.TD_API_KEY, {
    logging: true,
  });

  try {
    // Authenticate and connect
    console.log('🔐 Authenticating...');
    await client.auth();
    
    console.log('🔌 Connecting to sandbox...');
    await client.connect();

    console.log('\n✅ Connected!\n');

    // Example 1: Simple AI task without validation
    console.log('📝 Example 1: Simple AI task');
    console.log('Task: "Click on the username field"');
    await client.ai('Click on the username field');
    console.log('✓ Task completed\n');

    // Example 2: AI task with validation loop
    console.log('📝 Example 2: AI task with validation loop');
    console.log('Task: "Enter test123 as the username"');
    const result = await client.ai('Enter test123 as the username', { 
      validateAndLoop: true 
    });
    console.log('✓ Task completed and validated');
    if (result) {
      console.log('AI Assessment:', result);
    }
    console.log('');

    // Example 3: Complex multi-step task
    console.log('📝 Example 3: Complex multi-step task');
    console.log('Task: "Fill in the login form with username test123 and password demo456, then click login"');
    await client.ai(
      'Fill in the login form with username test123 and password demo456, then click login',
      { validateAndLoop: true }
    );
    console.log('✓ Multi-step task completed\n');

    // Example 4: Navigation task
    console.log('📝 Example 4: Navigation task');
    console.log('Task: "Open the settings page"');
    await client.ai('Open the settings page', { validateAndLoop: true });
    console.log('✓ Navigation completed\n');

    console.log('🎉 All AI examples completed successfully!');

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
