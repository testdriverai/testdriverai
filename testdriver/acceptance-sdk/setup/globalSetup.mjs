/**
 * Global setup for Vitest tests
 * Runs once before all tests
 */

import TestDriver from '../../../index.js';

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
    console.log('📹 Setting up dashcam tracking...');
    
    // Track TestDriver application logs
    await driver.exec({
      lang: 'pwsh',
      code: 'dashcam track --name=TestDriver --type=application --pattern="C:\\Users\\testdriver\\Documents\\testdriver.log"'
    });
    
    // Start dashcam recording
    await driver.exec({
      lang: 'pwsh',
      code: 'dashcam start'
    });
    
    console.log('🌐 Launching Chrome...');
    
    // Launch Chrome with the sandbox application
    await driver.exec({
      lang: 'pwsh',
      code: 'Start-Process "C:/Program Files/Google/Chrome/Application/chrome.exe" -ArgumentList "--start-maximized", "--guest", "https://testdriver-sandbox.vercel.app/login"'
    });
    
    // Wait for the page to load
    await driver.waitForText({
      text: 'TestDriver.ai Sandbox',
      timeout: 60000
    });
    
    console.log('✅ Chrome launched and page loaded successfully');
  } catch (error) {
    console.error('❌ Setup failed:', error);
    throw error;
  }
}

export async function teardown() {
  console.log('🧹 Test suite complete');
}
