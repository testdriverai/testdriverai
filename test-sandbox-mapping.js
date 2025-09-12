#!/usr/bin/env node

// Simple test to validate the mapping logic
const { createSandbox } = require('./agent/lib/sandbox');
const EventEmitter = require('events');

const emitter = new EventEmitter();
const analytics = { track: () => Promise.resolve() };

const sandbox = createSandbox(emitter, analytics);

// Mock socket to test the transformation logic
sandbox.socket = {
  _socket: {
    remoteAddress: '192.168.1.100' // Not TD_API_ROOT to trigger direct connection logic
  },
  send: (data) => {
    console.log('Would send:', JSON.parse(data));
  },
  readyState: 1
};

console.log('🧪 Testing message transformations\n');

// Test cases
const testCases = [
  { type: 'system.screenshot' },
  { type: 'leftClick', x: 100, y: 200 },
  { type: 'scroll', direction: 'down', amount: 500 },
  { type: 'press', keys: ['ctrl', 'c'] },
  { type: 'type', text: 'Hello World' },
  { type: 'commands.run', command: 'echo test' }
];

testCases.forEach((testCase, i) => {
  console.log(`Test ${i + 1}: ${testCase.type}`);
  console.log('Input:', testCase);
  try {
    sandbox.send(testCase);
  } catch (e) {
    console.log('Error:', e.message);
  }
  console.log('---\n');
});

console.log('✅ Mapping test completed');
