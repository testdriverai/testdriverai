/**
 * Google Login snippet - reusable Google login function
 * 
 * This demonstrates how to create reusable test snippets that can be
 * imported and used across multiple test files for Google authentication.
 */
export async function loginGoogle(testdriver) {
  // Find and click the "Continue with Google" or Google sign-in button
  const googleButton = await testdriver.find(
    'Google sign in button or Continue with Google button'
  );
  await googleButton.click();

  // Wait for Google login page to load
  await testdriver.wait(2000);

  // Enter email
  const emailField = await testdriver.find('email input field');
  await emailField.click();
  
  // Type the email address - using environment variable or default
  const email = process.env.GOOGLE_TEST_EMAIL || 'test@example.com';
  await testdriver.type(email);

  // Click Next button
  const nextButton = await testdriver.find('Next button');
  await nextButton.click();

  // Wait for password page
  await testdriver.wait(2000);

  // Enter password
  const passwordField = await testdriver.find('password input field');
  await passwordField.click();
  
  // Type the password - using environment variable, marked as secret
  const password = process.env.GOOGLE_TEST_PASSWORD || 'password';
  await testdriver.type(password, { secret: true });

  // Click Next/Sign in button
  const signInButton = await testdriver.find('Next button or Sign in button');
  await signInButton.click();

  // Wait for login to complete
  await testdriver.wait(3000);
}