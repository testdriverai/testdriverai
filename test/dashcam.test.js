/**
 * Dashcam Class - Unit Tests
 * Tests for the new Dashcam class
 */

const { Dashcam } = require('../src/core');

// Mock TestDriver client
class MockTestDriver {
  constructor(os = 'linux') {
    this.os = os;
    this.commands = [];
  }
  
  async exec(shell, command, timeout, silent) {
    this.commands.push({ shell, command, timeout, silent });
    
    // Mock responses
    if (command.includes('npm prefix -g')) {
      return this.os === 'windows' 
        ? 'C:\\Users\\testdriver\\AppData\\Roaming\\npm'
        : '/usr/local';
    }
    
    if (command.includes('stop')) {
      return 'Recording stopped\nReplay URL: https://app.testdriver.ai/replay/abc123?share=xyz';
    }
    
    return 'OK';
  }
  
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

async function testDashcamCreation() {
  console.log('🧪 Test: Dashcam creation');
  
  const client = new MockTestDriver();
  const dashcam = new Dashcam(client);
  
  console.assert(dashcam.client === client, 'Client should be stored');
  console.assert(dashcam.recording === false, 'Should not be recording initially');
  console.assert(dashcam._authenticated === false, 'Should not be authenticated initially');
  
  console.log('✅ Dashcam creation test passed');
}

async function testDashcamWithOptions() {
  console.log('\n🧪 Test: Dashcam with options');
  
  const client = new MockTestDriver();
  const dashcam = new Dashcam(client, {
    apiKey: 'custom-key',
    autoStart: true,
    logs: [
      { type: 'file', path: '/tmp/test.log', name: 'Test Log' }
    ]
  });
  
  console.assert(dashcam.apiKey === 'custom-key', 'Custom API key should be used');
  console.assert(dashcam.autoStart === true, 'Auto start should be enabled');
  console.assert(dashcam.logs.length === 1, 'Logs should be stored');
  
  console.log('✅ Dashcam options test passed');
}

async function testErrorOnMissingClient() {
  console.log('\n🧪 Test: Error when client missing');
  
  try {
    new Dashcam();
    console.error('❌ Should have thrown error');
    process.exit(1);
  } catch (error) {
    console.assert(
      error.message.includes('TestDriver client'),
      'Error message should mention TestDriver client'
    );
  }
  
  console.log('✅ Missing client error test passed');
}

async function testStopReturnsUrl() {
  console.log('\n🧪 Test: Stop returns URL');
  
  const client = new MockTestDriver();
  const dashcam = new Dashcam(client);
  
  dashcam.recording = true;  // Simulate recording state
  const url = await dashcam.stop();
  
  console.assert(url !== null, 'URL should be returned');
  console.assert(url.includes('replay'), 'URL should contain replay');
  console.assert(dashcam.recording === false, 'Should stop recording');
  
  console.log('✅ Stop returns URL test passed');
  console.log('   URL:', url);
}

async function testIsRecording() {
  console.log('\n🧪 Test: isRecording method');
  
  const client = new MockTestDriver();
  const dashcam = new Dashcam(client);
  
  let recording = await dashcam.isRecording();
  console.assert(recording === false, 'Should not be recording initially');
  
  dashcam.recording = true;
  recording = await dashcam.isRecording();
  console.assert(recording === true, 'Should return recording state');
  
  console.log('✅ isRecording test passed');
}

async function runAllTests() {
  console.log('🚀 Running Dashcam class tests...\n');
  
  try {
    await testDashcamCreation();
    await testDashcamWithOptions();
    await testErrorOnMissingClient();
    await testStopReturnsUrl();
    await testIsRecording();
    
    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runAllTests();
