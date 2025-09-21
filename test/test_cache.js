const { SDKCache } = require('../agent/lib/cache');

// Test the caching functionality
async function testCache() {
  console.log('Testing SDK Cache functionality...\n');

  // Initialize cache
  const cache = new SDKCache('test-cache');

  try {
    // Test 1: Basic caching without screenshots
    console.log('Test 1: Basic caching without screenshots');
    const testPath = 'test/path';
    const testData = { param1: 'value1', param2: 'value2' };
    const testResponse = { success: true, data: 'test response' };

    // Store cache entry
    await cache.set(testPath, testData, testResponse);

    // Retrieve cache entry
    const cachedResponse = await cache.get(testPath, testData);
    console.log('Cache retrieval successful:', cachedResponse !== null);
    console.log('Response matches:', JSON.stringify(cachedResponse) === JSON.stringify(testResponse));
    console.log('');

    // Test 2: Screenshot similarity testing
    console.log('Test 2: Screenshot similarity testing');
    
    // Create a simple base64 test image (1x1 pixel)
    const testScreenshot = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64').toString('base64');
    
    const testDataWithImage = { 
      param1: 'value1', 
      image: testScreenshot 
    };
    const testResponseWithImage = { success: true, data: 'test response with image' };

    // Store cache entry with screenshot
    await cache.set(testPath + '_image', testDataWithImage, testResponseWithImage);

    // Retrieve with same screenshot
    const cachedResponseWithImage = await cache.get(testPath + '_image', testDataWithImage);
    console.log('Cache retrieval with identical screenshot successful:', cachedResponseWithImage !== null);

    // Test 3: Cache statistics
    console.log('\nTest 3: Cache statistics');
    const stats = await cache.getStats();
    console.log('Cache stats:', stats);

    // Test 4: Hash generation
    console.log('\nTest 4: Hash generation');
    const hash1 = cache.generateHash('test/path', { param1: 'value1', image: 'base64data' });
    const hash2 = cache.generateHash('test/path', { param1: 'value1', image: 'different_base64data' });
    console.log('Same hash for different images (expected):', hash1 === hash2);

    const hash4 = cache.generateHash('test/path', { param1: 'value2' });
    console.log('Different hash for different data (expected):', hash1 !== hash4);

    console.log('\nAll tests completed successfully! 🎉');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Clean up test cache
    await cache.clear();
    console.log('Test cache cleaned up');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testCache();
}

module.exports = { testCache };
