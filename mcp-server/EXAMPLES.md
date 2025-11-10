# TestDriver MCP Server - Example Prompts for Claude

This file contains example prompts you can use with Claude once the TestDriver MCP server is configured.

## Setup Verification

```
Can you list the available TestDriver tools?
```

## Example 1: Simple Web Navigation Test

```
Please use TestDriver to create a test that:
1. Connects to the sandbox
2. Opens Chrome and navigates to https://testdriver-sandbox.vercel.app/login
3. Waits for the page to load
4. Takes a screenshot
5. Disconnects

Execute each step and let me know the results.
```

## Example 2: Login Flow Test

```
Use TestDriver to test a login flow:
1. Connect to sandbox
2. Focus Google Chrome
3. Wait for the "TestDriver.ai Sandbox" text to appear
4. Click on the "Username" field
5. Type "standard_user"
6. Press Tab key
7. Type "secret_password"
8. Press Enter
9. Wait for "Dashboard" text to appear
10. Assert that login was successful
11. Take a screenshot
12. Disconnect
```

## Example 3: Extract Data from Screen

```
Claude, please:
1. Connect to TestDriver sandbox
2. Navigate to a page with user information
3. Use the remember tool to extract:
   - The username displayed
   - The email address shown
   - Any error messages visible
4. Return the extracted data to me
5. Disconnect
```

## Example 4: Visual Testing

```
Create a visual regression test:
1. Connect to TestDriver
2. Navigate to the product page
3. Scroll until "Product Details" is visible
4. Take a screenshot and save it as baseline
5. Click on the "Reviews" tab
6. Wait for reviews to load
7. Assert that at least one review is visible
8. Take another screenshot
9. Disconnect
```

## Example 5: Desktop Application Test

```
Test a Windows desktop application:
1. Connect to TestDriver sandbox
2. Execute PowerShell command to launch Notepad: `Start-Process notepad.exe`
3. Wait 2 seconds for Notepad to open
4. Focus the "Notepad" application
5. Type "This is a test document created by TestDriver MCP"
6. Press Ctrl+A to select all
7. Press Ctrl+C to copy
8. Assert that text is in the clipboard
9. Take a screenshot
10. Press Alt+F4 to close without saving
11. Disconnect
```

## Example 6: Form Interaction

```
Test form submission:
1. Connect to TestDriver
2. Navigate to a registration form
3. Click on "First Name" field and type "John"
4. Click on "Last Name" field and type "Doe"
5. Click on "Email" field and type "john.doe@example.com"
6. Scroll down if needed to see the Submit button
7. Click the Submit button
8. Wait for success message
9. Assert that "Registration Successful" appears
10. Take a screenshot
11. Disconnect
```

## Example 7: Scrolling and Discovery

```
Test infinite scroll behavior:
1. Connect to TestDriver
2. Open a page with infinite scroll
3. Scroll down 5 times
4. Use scrollUntilText to find "Load More" button
5. Click "Load More"
6. Wait for new content to appear
7. Assert that content count increased
8. Take a screenshot
9. Disconnect
```

## Example 8: Multi-Step User Journey

```
Simulate a complete user journey:
1. Connect to TestDriver sandbox
2. Navigate to e-commerce site
3. Search for "laptop"
4. Scroll until product is visible
5. Click on first product
6. Remember the product price
7. Click "Add to Cart"
8. Wait for cart confirmation
9. Click on cart icon
10. Assert that product is in cart
11. Verify the price matches what was remembered
12. Take screenshot of cart
13. Disconnect
```

## Example 9: Error Handling Test

```
Test error scenarios:
1. Connect to TestDriver
2. Navigate to login page
3. Click "Login" button without entering credentials
4. Assert that "Username is required" error appears
5. Type invalid email "not-an-email"
6. Click Login
7. Assert that "Invalid email format" error appears
8. Take screenshot of errors
9. Disconnect
```

## Example 10: Generate a Complete Test File

```
Claude, please help me create a complete JavaScript test file using the TestDriver SDK that:
1. Tests the login flow at https://testdriver-sandbox.vercel.app/login
2. Includes proper setup and teardown
3. Uses the createTestClient helper from testHelpers.mjs
4. Has descriptive test steps
5. Includes assertions
6. Handles errors gracefully

Then, use the TestDriver MCP tools to actually run and verify the test works correctly.
```

## Pro Tips for Using TestDriver with Claude

### Be Specific
Instead of: "Click the button"
Use: "Click the button with text 'Submit Form'"

### Provide Context
Instead of: "Type the username"
Use: "Click on the 'Username' field and type 'test_user'"

### Use Descriptive Assertions
Instead of: "Check if it worked"
Use: "Assert that the text 'Welcome, test_user' is visible on the screen"

### Chain Operations
You can ask Claude to perform multiple operations in sequence, and it will maintain the TestDriver connection throughout the conversation.

### Request Screenshots
Always ask for screenshots at key points to verify the test is progressing correctly.

### Error Recovery
If a test fails, ask Claude to:
1. Take a screenshot to see current state
2. Retry with adjusted parameters
3. Use different element identifiers

## Advanced Use Cases

### Generate Tests from Requirements

```
Claude, I need to test a checkout flow with these requirements:
- User must be logged in
- Cart must have at least one item
- User fills in shipping address
- User selects payment method
- User confirms order
- Success message appears

Please:
1. Use TestDriver MCP tools to create and execute this test
2. Show me the test code
3. Report any issues found
4. Suggest improvements
```

### Visual Regression Testing

```
Help me set up visual regression testing:
1. Connect to TestDriver
2. Navigate through these pages: [Home, Products, Cart, Checkout]
3. Take a screenshot of each page
4. Store the screenshots as baselines
5. Generate a test script that can compare future runs against these baselines
```

### Accessibility Testing

```
Use TestDriver to check accessibility:
1. Navigate to the page
2. Execute JavaScript to check for:
   - Images without alt text
   - Form inputs without labels
   - Buttons without accessible names
3. Report all accessibility issues found
4. Take screenshots highlighting problem areas
```
