const { expect } = require('chai');
const { createSandbox } = require('../agent/lib/sandbox.js');
const { EventEmitter2 } = require('eventemitter2');

describe('GitHub Actions Environment Simulation', function() {
  let emitter, analytics, sandbox;

  beforeEach(function() {
    emitter = new EventEmitter2();
    analytics = { track: () => Promise.resolve() };
    sandbox = createSandbox(emitter, analytics);
  });

  afterEach(function() {
    if (sandbox && sandbox.cleanup) {
      try {
        sandbox.cleanup();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }
  });

  it('should prevent call stack exceeded errors during repeated connection failures', async function() {
    this.timeout(15000);

    const errors = [];
    const connectionUrl = 'wss://192.0.2.1:443'; // Test IP that will fail
    
    // Simulate rapid connection attempts that could cause call stack issues
    for (let i = 0; i < 5; i++) {
      try {
        await sandbox.boot(connectionUrl);
      } catch (error) {
        errors.push(error);
      }
    }
    
    // Should have caught connection errors
    expect(errors.length).to.be.greaterThan(0);
    
    // None should be RangeError (Maximum call stack size exceeded)
    const rangeErrors = errors.filter(e => e instanceof RangeError);
    expect(rangeErrors).to.have.length(0, 'Should not have RangeError (call stack exceeded)');
    
    // Should eventually hit connection attempt limit
    const maxAttemptErrors = errors.filter(e => 
      e.message && e.message.includes('Maximum connection attempts')
    );
    expect(maxAttemptErrors.length).to.be.greaterThan(0, 'Should hit connection attempt limit');
  });

  it('should handle concurrent connection attempts gracefully', async function() {
    this.timeout(10000);
    
    const connectionUrl = 'wss://192.0.2.1:443';
    const promises = [];
    
    // Try to make concurrent connections
    for (let i = 0; i < 3; i++) {
      promises.push(
        sandbox.boot(connectionUrl).catch(error => error)
      );
    }
    
    const results = await Promise.all(promises);
    
    // Should have at least one "already in progress" error
    const concurrentErrors = results.filter(r => 
      r instanceof Error && r.message.includes('Connection attempt already in progress')
    );
    
    expect(concurrentErrors.length).to.be.greaterThan(0, 'Should prevent concurrent connections');
    
    // None should be call stack errors
    const rangeErrors = results.filter(r => r instanceof RangeError);
    expect(rangeErrors).to.have.length(0, 'Should not have call stack errors');
  });

  it('should properly cleanup resources on failure', async function() {
    this.timeout(5000);
    
    const connectionUrl = 'wss://192.0.2.1:443';
    
    try {
      await sandbox.boot(connectionUrl);
    } catch (error) {
      // Expected to fail
    }
    
    // After failure, should be able to clean up
    expect(() => sandbox.cleanup()).to.not.throw();
    
    // State should be reset
    expect(sandbox.isBooting).to.be.false;
    expect(sandbox.apiSocketConnected).to.be.false;
    expect(sandbox.heartbeat).to.be.null;
  });
});