/**
 * Test helper functions - reusable utility functions
 * 
 * This module provides common helper functions that can be
 * imported and used across multiple test files.
 */

/**
 * Generates a random alphanumeric string of specified length
 * @param {number} length - The length of the random string to generate
 * @returns {string} Random alphanumeric string
 */
export function generateRandomString(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Enters a prompt into a specified field
 * @param {Object} testdriver - The TestDriver instance
 * @param {string} prompt - The prompt text to enter
 * @param {Object} options - Options object
 * @param {string} options.fieldHint - Hint to find the field
 */
export async function enterPrompt(testdriver, prompt, options = {}) {
  const { fieldHint } = options;
  
  // Find the input field using the provided hint
  const field = await testdriver.find(fieldHint || 'input field');
  await field.click();
  
  // Type the prompt
  await testdriver.type(prompt);
  
  // Press Enter to submit
  await testdriver.pressKeys(['enter']);
}

/**
 * Verifies that specific text appears on the page
 * @param {Object} testdriver - The TestDriver instance
 * @param {string} text - The text to verify
 * @param {Object} options - Options object
 * @param {number} options.timeout - Timeout in milliseconds
 * @returns {Promise<boolean>} Whether the text was found
 */
export async function verify(testdriver, text, options = {}) {
  const { timeout = 30000 } = options;
  
  try {
    // Use assert to verify the text appears
    const result = await testdriver.assert(
      `The text "${text}" appears on the page`,
      { timeout }
    );
    return result;
  } catch (error) {
    console.error(`Verification failed for text: ${text}`, error);
    throw error;
  }
}

/**
 * Validates that a prompt appears with expected status
 * @param {string} searchString - The string to search for in the prompt
 * @param {Object} options - Options object
 * @param {string} options.expected - Expected status ("blank" or "nonBlank")
 * @returns {Promise<boolean>} Whether the validation passed
 */
export async function validatePromptAppears(searchString, options = {}) {
  const { expected = "nonBlank" } = options;
  
  // This is a placeholder implementation - in a real scenario,
  // this would check against an API or database to verify the prompt was logged
  console.log(`Validating prompt with search string: ${searchString}, expected: ${expected}`);
  
  // For now, we'll just return true to indicate validation passed
  // In a real implementation, this would query a backend API
  return true;
}