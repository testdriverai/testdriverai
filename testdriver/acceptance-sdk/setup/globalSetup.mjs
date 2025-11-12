/**
 * Global setup for Vitest tests
 * Runs once before all tests
 */

export async function setup() {
  console.log('🚀 Starting TestDriver SDK test suite...');
  
  // Verify API key is set
  if (!process.env.TD_API_KEY) {
    throw new Error('TD_API_KEY environment variable is not set');
  }
  
  console.log('✅ Environment configured');
}

export async function teardown() {
  console.log('🧹 Test suite complete');
}
