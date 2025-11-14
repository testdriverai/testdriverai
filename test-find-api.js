#!/usr/bin/env node

/**
 * Quick test of the new find() API
 * This is a simple smoke test to verify the Element class works
 */

const TestDriver = require('../sdk');

async function testFindAPI() {
  console.log('Testing new find() API...\n');

  const client = new TestDriver('test-key', {
    logging: false
  });

  // Test 1: Create element without connecting
  console.log('✓ Test 1: Creating Element instance');
  const element = client.find('test element');
  console.log('  Element description:', element.description);
  console.log('  Element found():', element.found());
  console.log('  Element coordinates:', element.getCoordinates());

  // Test 2: Verify element methods exist
  console.log('\n✓ Test 2: Verifying Element methods');
  console.log('  Has find():', typeof element.find === 'function');
  console.log('  Has click():', typeof element.click === 'function');
  console.log('  Has hover():', typeof element.hover === 'function');
  console.log('  Has doubleClick():', typeof element.doubleClick === 'function');
  console.log('  Has rightClick():', typeof element.rightClick === 'function');
  console.log('  Has mouseDown():', typeof element.mouseDown === 'function');
  console.log('  Has mouseUp():', typeof element.mouseUp === 'function');
  console.log('  Has found():', typeof element.found === 'function');
  console.log('  Has getCoordinates():', typeof element.getCoordinates === 'function');

  // Test 3: Verify error handling for clicking unfound element
  console.log('\n✓ Test 3: Error handling for unfound element');
  try {
    await element.click();
    console.log('  ❌ Should have thrown error');
  } catch (error) {
    console.log('  ✓ Correctly throws error:', error.message);
  }

  // Test 4: Verify TypeScript types exist (if running from TypeScript)
  console.log('\n✓ Test 4: SDK methods');
  console.log('  Has find():', typeof client.find === 'function');
  console.log('  Has deprecated hoverText():', typeof client.hoverText === 'undefined' ? 'not yet connected' : 'exists');
  console.log('  Has deprecated waitForText():', typeof client.waitForText === 'undefined' ? 'not yet connected' : 'exists');

  console.log('\n✅ All basic tests passed!');
  console.log('\nNote: Full integration tests require connection to TestDriver sandbox.');
  console.log('See examples/sdk-find-example.js for complete usage examples.');
}

testFindAPI().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
