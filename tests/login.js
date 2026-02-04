/**
 * Login snippet - reusable login function
 * 
 * This demonstrates how to create reusable test snippets that can be
 * imported and used across multiple test files.
 */
export async function login(testdriver) {

  // The password is displayed on screen, have TestDriver extract it
  const password = await testdriver.extract('the password');

  // Find the username field
  const usernameField = await testdriver.find(
    'username input'
  );
  await usernameField.click();

  // Type username
  await testdriver.type('standard_user');

  // Enter password form earlier 
  // Marked as secret so it's not logged or stored
  await testdriver.pressKeys(['tab']);
  await testdriver.type(password, { secret: true });

  // Submit the form
  await testdriver.find('submit button on the login form').click();
}
