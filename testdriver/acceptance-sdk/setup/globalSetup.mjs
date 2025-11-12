/**
 * Global setup for Vitest tests
 * Runs once before all tests
 */

import TestDriver from '../../../sdk.js';

export async function setup() {
  console.log('🚀 Starting TestDriver SDK test suite...');
  
  // Verify API key is set
  if (!process.env.TD_API_KEY) {
    throw new Error('TD_API_KEY environment variable is not set');
  }
  
  console.log('✅ Environment configured');
  
  // Initialize TestDriver
  const driver = new TestDriver(process.env.TD_API_KEY);
  
  try {
    console.log('� Authenticating...');
    await driver.auth();
    
    console.log('🔌 Connecting to sandbox...');
    await driver.connect({ newSandbox: true });
    
    console.log('�📹 Setting up dashcam tracking...');
    
    // Track TestDriver application logs
    await driver.exec(
      'pwsh',
      'dashcam track --name=TestDriver --type=application --pattern="C:\\Users\\testdriver\\Documents\\testdriver.log"',
      10000,
      true
    );
    
    // Start dashcam recording
    await driver.exec('pwsh', 'dashcam start', 10000, true);
    
    console.log('🌐 Launching Chrome...');
    
    // Launch Chrome with the sandbox application
    await driver.exec(
      'pwsh',
      'Start-Process "C:/Program Files/Google/Chrome/Application/chrome.exe" -ArgumentList "--start-maximized", "--guest", "https://testdriver-sandbox.vercel.app/login"',
      10000,
      true
    );
    
    // Wait for the page to load
    await driver.waitForText('TestDriver.ai Sandbox', 60000);
    
    console.log('✅ Chrome launched and page loaded successfully');
  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  }
}

export async function teardown() {
  console.log('🧹 Test suite complete');
}
