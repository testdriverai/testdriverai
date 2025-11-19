#!/usr/bin/env node

/**
 * Simple test to verify prompt caching functionality
 * 
 * This test demonstrates that:
 * 1. First .prompt() call makes an API request and caches the YAML response
 * 2. Second .prompt() call with the same prompt uses the cached YAML
 * 3. Cache can be disabled with TD_NO_PROMPT_CACHE=true
 */

const TestDriver = require('./sdk.js');
const promptCache = require('./agent/lib/cache.js');

async function testPromptCache() {
  console.log('Testing prompt caching functionality...\n');

  const client = new TestDriver(process.env.TD_API_KEY, {
    os: 'linux',
    logging: true
  });

  try {
    // Connect to sandbox
    console.log('Connecting to sandbox...');
    await client.connect();
    console.log('Connected!\n');

    const testPrompt = 'click the search button';

    // Clear cache for this prompt to start fresh
    const cachePath = promptCache.getCachePath(testPrompt);
    console.log(`Cache path for "${testPrompt}": ${cachePath}\n`);

    // Test 1: First call (should make API request and cache)
    console.log('Test 1: First .ai() call (should cache the response)');
    const stats1 = promptCache.getCacheStats();
    console.log(`Cache before: ${stats1.count} files`);
    
    await client.ai(testPrompt);
    
    const stats2 = promptCache.getCacheStats();
    console.log(`Cache after: ${stats2.count} files`);
    console.log(`Cache hit: ${promptCache.hasCache(testPrompt) ? 'YES' : 'NO'}\n`);

    // Test 2: Second call (should use cache)
    console.log('Test 2: Second .ai() call with same prompt (should use cache)');
    console.log('Look for "(using cached response)" message above...\n');
    await client.ai(testPrompt);

    // Test 3: Third call with cache disabled (should make API call)
    console.log('\nTest 3: Third .ai() call with cache=false (should bypass cache)');
    await client.ai(testPrompt, false);

    // Test 4: Show cache contents
    console.log('\nTest 4: Cache contents');
    const cachedYaml = promptCache.readCache(testPrompt);
    if (cachedYaml) {
      console.log('Cached YAML preview (first 500 chars):');
      console.log(cachedYaml.substring(0, 500));
      console.log('...\n');
    }

    // Test 5: Cache statistics
    console.log('Test 5: Cache statistics');
    const finalStats = promptCache.getCacheStats();
    console.log(`Total cached prompts: ${finalStats.count}`);
    console.log(`Cache files:`, finalStats.files.slice(0, 5));

    console.log('\n✅ Prompt caching test completed!');
    console.log('\nTo disable caching, pass false: client.ai(prompt, false)');
    console.log('To clear cache, delete .testdriver/.cache/*.yaml files');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  } finally {
    // Disconnect
    await client.disconnect();
  }
}

// Run the test
if (require.main === module) {
  testPromptCache().catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });
}

module.exports = testPromptCache;
