const { createSDK } = require('./agent/lib/sdk');
const { createConfig } = require('./agent/lib/config');
const { createSession } = require('./agent/lib/session');
const { EventEmitter2 } = require('eventemitter2');

/**
 * Demo script showing the caching system in action
 * This simulates making requests to the SDK with caching enabled
 */
async function demoCache() {
  console.log('🚀 SDK Caching Demo\n');

  // Setup mock SDK environment
  const emitter = new EventEmitter2();
  const config = createConfig({ TD_API_ROOT: 'https://api.testdriver.ai', TD_API_KEY: 'demo-key' });
  const session = createSession();
  
  // Create SDK with caching enabled
  const sdk = createSDK(emitter, config, session);
  
  // Mock a base64 screenshot (small 1x1 pixel PNG)
  const mockScreenshot = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  
  console.log('📸 Making first request with screenshot...');
  
  // First request - this will be cached
  try {
    await sdk.req('assert/text', {
      needle: 'Login',
      method: 'contains',
      image: mockScreenshot
    });
  } catch (error) {
    console.log('✅ Expected error (no actual API call) - request would be cached:', error.code || 'Network error');
  }
  
  console.log('\n📸 Making identical request - should hit cache...');
  
  // Second identical request - this should hit the cache
  try {
    await sdk.req('assert/text', {
      needle: 'Login',
      method: 'contains',
      image: mockScreenshot
    });
  } catch (error) {
    console.log('✅ Expected error (no actual API call) - but cache was checked first:', error.code || 'Network error');
  }
  
  console.log('\n📸 Making request with different screenshot...');
  
  // Request with different screenshot - should NOT hit cache due to image difference
  const differentScreenshot = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/58qHQAFlwGAWjR9awAAAABJRU5ErkJggg==';
  
  try {
    await sdk.req('assert/text', {
      needle: 'Login',
      method: 'contains',
      image: differentScreenshot
    });
  } catch (error) {
    console.log('✅ Expected error (no actual API call) - new request due to different screenshot:', error.code || 'Network error');
  }
  
  console.log('\n📸 Making request without screenshot...');
  
  // Request without screenshot - should be cached
  try {
    await sdk.req('hover/text', {
      needle: 'Submit',
      method: 'contains'
    });
  } catch (error) {
    console.log('✅ Expected error (no actual API call) - request would be cached:', error.code || 'Network error');
  }
  
  // Same request again - should hit cache
  try {
    await sdk.req('hover/text', {
      needle: 'Submit',
      method: 'contains'
    });
  } catch (error) {
    console.log('✅ Expected error (no actual API call) - cache hit expected:', error.code || 'Network error');
  }
  
  console.log('\n📸 Making non-cacheable request...');
  
  // Non-cacheable request (generate doesn't get cached)
  try {
    await sdk.req('generate', {
      type: 'test',
      image: mockScreenshot
    });
  } catch (error) {
    console.log('✅ Expected error (no actual API call) - not cached (generate requests):', error.code || 'Network error');
  }
  
  console.log('\n🎯 Demo complete! Check testdriver/.cache directory to see cached entries.');
  console.log('💡 In real usage, cached requests would return actual responses instead of making API calls.');
}

// Run demo if this file is executed directly
if (require.main === module) {
  demoCache().catch(console.error);
}

module.exports = { demoCache };
