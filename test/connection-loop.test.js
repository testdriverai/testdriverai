const { expect } = require('chai');
const { createSandbox } = require('../agent/lib/sandbox.js');
const { EventEmitter2 } = require('eventemitter2');

describe('Connection Loop Prevention', function() {
  let emitter, analytics, sandbox;

  beforeEach(function() {
    emitter = new EventEmitter2();
    analytics = { track: () => Promise.resolve() };
    sandbox = createSandbox(emitter, analytics);
  });

  afterEach(function() {
    if (sandbox && sandbox.cleanup) {
      sandbox.cleanup();
    }
  });

  it('should prevent concurrent boot attempts', async function() {
    this.timeout(5000);

    // Start first boot attempt
    const firstBoot = sandbox.boot('wss://invalid-url.com');
    
    // Try to start second boot attempt while first is in progress
    try {
      await sandbox.boot('wss://another-invalid-url.com');
      expect.fail('Should have thrown error for concurrent boot attempt');
    } catch (error) {
      expect(error.message).to.include('Connection attempt already in progress');
    }

    // Clean up first boot attempt
    try {
      await firstBoot;
    } catch (error) {
      // Expected to fail with invalid URL
    }
  });

  it('should limit maximum connection attempts', async function() {
    this.timeout(10000);

    let lastError = null;
    const maxAttempts = 3;

    // Try to connect multiple times to trigger limit
    for (let i = 0; i < maxAttempts + 2; i++) {
      try {
        await sandbox.boot('wss://invalid-url-' + i + '.com');
      } catch (error) {
        lastError = error;
        if (error.message.includes('Maximum connection attempts')) {
          expect(sandbox.connectionAttempts).to.equal(maxAttempts);
          return;
        }
      }
    }

    // Should have hit the limit
    expect(lastError).to.not.be.null;
    expect(lastError.message).to.include('Maximum connection attempts');
  });

  it('should properly cleanup resources', function() {
    sandbox.isBooting = true;
    sandbox.apiSocketConnected = true;
    sandbox.heartbeat = setInterval(() => {}, 1000);
    sandbox.ps['test'] = { reject: () => {} };

    sandbox.cleanup();

    expect(sandbox.isBooting).to.be.false;
    expect(sandbox.apiSocketConnected).to.be.false;
    expect(sandbox.heartbeat).to.be.null;
    expect(Object.keys(sandbox.ps)).to.have.length(0);
  });

  it('should handle connection timeout', async function() {
    this.timeout(15000);
    
    try {
      // Try to connect to a valid but unreachable address that will timeout
      await sandbox.boot('wss://192.0.2.1:443'); // RFC 5737 test IP
      expect.fail('Should have timed out');
    } catch (error) {
      // Should get either timeout or connection error  
      expect(error.message).to.satisfy(msg => 
        msg.includes('timeout') || 
        msg.includes('Connection timeout') ||
        msg.includes('ECONNREFUSED') || 
        msg.includes('EHOSTUNREACH') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('WebSocket connection closed')
      );
    }
  });
});