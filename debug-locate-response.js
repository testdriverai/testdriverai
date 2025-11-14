#!/usr/bin/env node

/**
 * Debug script to inspect the full locate API response
 * Run this with: TD_API_KEY=your_key node debug-locate-response.js
 */

const TestDriverSDK = require('./sdk.js');

async function debugLocateResponse() {
  const client = new TestDriverSDK(process.env.TD_API_KEY, {
    os: 'linux'
  });
  
  try {
    console.log('Connecting to sandbox (Linux)...');
    await client.connect({ headless: true });
    
    console.log('Opening a test page...');
    await client.focusApplication('Google Chrome');
    await client.type('https://example.com');
    await client.pressKeys(['enter']);
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\nFinding an element to inspect the response...');
    const element = await client.find('the heading that says Example Domain');
    
    console.log('\n='.repeat(60));
    console.log('FULL LOCATE API RESPONSE:');
    console.log('='.repeat(60));
    
    const response = element.getResponse();
    console.log(JSON.stringify(response, null, 2));
    
    console.log('\n='.repeat(60));
    console.log('RESPONSE KEYS:');
    console.log('='.repeat(60));
    
    if (response) {
      Object.keys(response).forEach(key => {
        const value = response[key];
        const type = Array.isArray(value) ? 'array' : typeof value;
        const preview = typeof value === 'string' && value.length > 100 
          ? `${value.substring(0, 100)}... (${value.length} chars)`
          : typeof value === 'object' 
          ? JSON.stringify(value)
          : value;
        
        console.log(`  ${key} (${type}): ${preview}`);
      });
    }
    
    console.log('\n='.repeat(60));
    console.log('ELEMENT PROPERTIES:');
    console.log('='.repeat(60));
    console.log('  found:', element.found());
    console.log('  x:', element.x);
    console.log('  y:', element.y);
    console.log('  centerX:', element.centerX);
    console.log('  centerY:', element.centerY);
    console.log('  width:', element.width);
    console.log('  height:', element.height);
    console.log('  confidence:', element.confidence);
    console.log('  text:', element.text);
    console.log('  label:', element.label);
    console.log('  screenshot:', element.screenshot ? `${element.screenshot.length} chars` : null);
    console.log('  boundingBox:', element.boundingBox);
    
    await client.disconnect();
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    await client.disconnect();
    process.exit(1);
  }
}

debugLocateResponse();
