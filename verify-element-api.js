#!/usr/bin/env node

/**
 * Verify Element class API
 * Tests that all expected methods and properties are available
 */

async function verify() {
  // Create a test element instance - need to access Element class directly
  const { Element } = require('./sdk.js');
  const elem = new Element('test', null, null, null);

  console.log('Verifying Element class API...\n');

// Check methods exist
const methods = [
  'find', 
  'found', 
  'click', 
  'hover', 
  'doubleClick', 
  'rightClick', 
  'mouseDown', 
  'mouseUp', 
  'getCoordinates', 
  'getResponse'
];

let passed = 0;
let failed = 0;

console.log('Testing methods:');
methods.forEach(method => {
  if (typeof elem[method] === 'function') {
    console.log(`  ✓ ${method}()`);
    passed++;
  } else {
    console.log(`  ✗ ${method}() - MISSING`);
    failed++;
  }
});

// Test property getters (should return null when element not found)
const props = [
  'x', 
  'y', 
  'centerX', 
  'centerY', 
  'width', 
  'height', 
  'confidence', 
  'screenshot', 
  'boundingBox', 
  'text', 
  'label'
];

console.log('\nTesting properties (should be null when not found):');
props.forEach(prop => {
  if (prop in elem) {
    const value = elem[prop];
    if (value === null) {
      console.log(`  ✓ ${prop} = null`);
      passed++;
    } else {
      console.log(`  ✗ ${prop} = ${value} (expected null)`);
      failed++;
    }
  } else {
    console.log(`  ✗ ${prop} - MISSING`);
    failed++;
  }
});

  console.log('\n' + '='.repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('\n✅ All Element API verification tests passed!');
  }
}

verify().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
