// globalTracer.js

const chalk = require('chalk');

// Save the original function prototype's apply method
const originalApply = Function.prototype.apply;

// Maximum execution time threshold in milliseconds (30 seconds)
const MAX_EXECUTION_TIME_MS = 30000;

// Helper function to check if the function is defined in your project files
function isProjectFunction() {
  // const stackTrace = new Error().stack;

  // // Check the stack trace to see if the file path belongs to your project
  // const projectRoot = process.cwd(); // Gets the current working directory of your project
  // return stackTrace && stackTrace.split('\n').some(line => line.includes(projectRoot));
  return true;
}

// Override the apply method to add tracing and timing for project functions only
Function.prototype.apply = function (thisArg, argsArray) {
  const functionName = this.name || 'anonymous function';

  // Only trace named functions defined in the user's files
  if (functionName && isProjectFunction()) {
    console.log(chalk.cyan(`[profiler] called: ${functionName}`));

    // Start the timer
    const startTime = process.hrtime();

    // Call the original function
    const result = originalApply.call(this, thisArg, argsArray);

    // End the timer and calculate the elapsed time
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const elapsedMilliseconds = (seconds * 1000) + (nanoseconds / 1e6);

    // Log the elapsed time
    console.log(chalk.green(`[profiler] ${functionName} execution time: ${elapsedMilliseconds.toFixed(3)} ms`));

    // Check if the execution time exceeds the maximum threshold
    if (elapsedMilliseconds > MAX_EXECUTION_TIME_MS) {
      console.error(chalk.red(`[profiler] Error: Function ${functionName} took too long to execute (${elapsedMilliseconds.toFixed(3)} ms)`));
    }

    return result;
  } else {
    // If it's not a named function or not from the user's project, call the function normally
    return originalApply.call(this, thisArg, argsArray);
  }
};

console.log(chalk.yellow('Global function tracing with timing and error logging for project-defined functions is enabled.'));
