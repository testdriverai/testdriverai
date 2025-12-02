/**
 * Quick test to verify stack trace filtering works
 */

// Mock the MatchError similar to commands.js
class MatchError extends Error {
  constructor(message, fatal = false) {
    super(message);
    this.fatal = fatal;
    this.attachScreenshot = true;
  }
}

// Simulate SDK wrapper with stack filtering (improved version)
class TestSDK {
  constructor() {
    const command = async (message) => {
      // Simulate the command throwing an error
      throw new MatchError(`AI Assertion failed: ${message}`, true);
    };

    // Wrap the method with proper stack trace handling
    this.assert = async function (...args) {
      // Capture the call site for better error reporting
      const callSite = {};
      Error.captureStackTrace(callSite, this.assert);

      try {
        return await command(...args);
      } catch (error) {
        // Replace the stack trace to point to the actual caller
        if (Error.captureStackTrace && callSite.stack) {
          const errorMessage = error.stack?.split("\n")[0];
          const callerStack = callSite.stack?.split("\n").slice(1);
          error.stack = errorMessage + "\n" + callerStack.join("\n");
        }
        throw error;
      }
    }.bind(this);
  }
}

// Test it
async function runTest() {
  const client = new TestSDK();

  try {
    console.log("Testing stack trace...\n");
    await client.assert("home page appears"); // Line 42 - this should show in stack
  } catch (error) {
    console.log("Error caught!");
    console.log("Stack trace:");
    console.log(error.stack);
  }
}

runTest();
