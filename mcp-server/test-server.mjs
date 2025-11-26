#!/usr/bin/env node
import { spawn } from 'child_process';

console.log('🧪 Testing TestDriver MCP Server...\n');

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let startupMessageReceived = false;

server.stderr.on('data', (data) => {
  const output = data.toString();
  console.log('Server output:', output);
  
  if (output.includes('TestDriver MCP server running')) {
    startupMessageReceived = true;
    console.log('\n✅ Server started successfully!');
    console.log('✅ Ready to accept MCP connections');
    
    setTimeout(() => {
      server.kill();
      console.log('\n🎉 Test passed! Server is working correctly.\n');
      process.exit(0);
    }, 500);
  }
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});

setTimeout(() => {
  if (!startupMessageReceived) {
    console.log('\n❌ Server did not start in time');
    server.kill();
    process.exit(1);
  }
}, 3000);
