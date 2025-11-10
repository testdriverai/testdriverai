# TestDriver MCP Server - VM Management & Test Generation Examples

This guide shows how to use the MCP server to spawn VMs, interact with them, build tests incrementally, and save them to files.

## Workflow Overview

The typical workflow for AI-driven test generation:

1. **Spawn VM with debugger** - Start a sandbox with live UI
2. **Perform test actions** - Interact with the application
3. **Build test file incrementally** - Save each action to a file
4. **Run the complete test** - Execute the saved test
5. **Iterate and refine** - Modify and improve the test

---

## Example 1: Spawn VM and View in Browser

```
Claude, please:
1. Connect to TestDriver with the debugger enabled
2. Give me the debugger URL so I can watch the VM
3. Get the sandbox information
```

**Expected Response:**
```
Successfully connected to TestDriver sandbox
Debugger UI available at: http://localhost:3000
You can view the live VM screen in your browser.
Sandbox ID: i-0abc123def456

Sandbox Information:
{
  "instanceId": "i-0abc123def456",
  "ip": "54.123.45.67",
  "status": "running",
  "resolution": "1366x768",
  "debuggerUrl": "http://localhost:3000"
}
```

---

## Example 2: Build a Test Incrementally

```
Claude, let's build a login test step by step:

1. Connect to TestDriver (with debugger)
2. Navigate to https://testdriver-sandbox.vercel.app/login
3. For each action I perform, append it to a YAML file at ./tests/login.yaml:
   - Wait for "TestDriver.ai Sandbox" text
   - Click on Username field
   - Type "standard_user"
   - Press Tab
   - Type "secret_password"  
   - Press Enter
   - Assert "Dashboard" appears

4. Show me the final test file
5. Run the test to verify it works
```

---

## Example 3: Interactive Test Building

```
I want to build a test interactively. Here's what I need:

1. Start a VM with debugger
2. Open the debugger URL (give it to me)
3. Navigate to the application
4. I'll tell you what to do next, and for each action:
   - Perform the action
   - Append it to tests/my-test.yaml
   - Take a screenshot
   - Wait for my next instruction

Let's start by clicking the login button.
```

---

## Example 4: Record Session and Generate Test

```
Claude, please record a complete user session:

1. Connect to TestDriver with debugger
2. Perform these actions (and track them all):
   - Navigate to e-commerce site
   - Search for "laptop"
   - Click first result
   - Add to cart
   - Go to checkout
   - Fill in shipping info
   - Take screenshots at each major step

3. When done, create a test file from all the actions at:
   - YAML: ./tests/checkout-flow.yaml
   - JavaScript: ./tests/checkout-flow.test.mjs

4. Show me both files
5. Run the YAML version to verify
```

---

## Example 5: Build Multiple Test Files

```
Help me create a test suite:

1. Connect to TestDriver
2. Create three separate test files by performing and recording actions:

   a) tests/login.yaml - Login test
      - Navigate to login page
      - Enter credentials
      - Verify dashboard

   b) tests/search.yaml - Search test  
      - Perform search
      - Verify results
      - Click first result

   c) tests/logout.yaml - Logout test
      - Click user menu
      - Click logout
      - Verify logged out

3. For each test, append commands one by one
4. Show me all three files when complete
5. Disconnect
```

---

## Example 6: Test a Desktop Application

```
Let's test a Windows desktop app:

1. Connect to TestDriver with debugger so I can watch
2. Execute PowerShell to launch Calculator: `Start-Process calc.exe`
3. Wait for calculator to appear
4. Focus the Calculator application
5. Record each action to tests/calculator.yaml:
   - Type "5"
   - Click "+"
   - Type "3"
   - Click "="
   - Assert "8" is displayed

6. Save the test and run it
7. Give me the debugger URL
```

---

## Example 7: Generate JavaScript Test from Actions

```
Create a JavaScript test file:

1. Connect to TestDriver
2. Perform a login flow (track all actions)
3. Create a JavaScript test file at:
   testdriver/acceptance-sdk/generated-login.test.mjs
   
4. The test should:
   - Use createTestClient from testHelpers.mjs
   - Have proper setup/teardown
   - Include all the login actions
   - Follow the same structure as other tests in acceptance-sdk/

5. Show me the generated test file
6. Run it with vitest to verify
```

---

## Example 8: Append to Existing Test

```
I have an existing test at tests/user-flow.yaml.

Please:
1. Connect to TestDriver
2. Read the current test file
3. Add these new steps to the end:
   - Scroll down to footer
   - Click "Contact Us" link
   - Wait for contact form
   - Fill in email field
   - Assert form is valid

4. Show me the updated test
5. Run it
```

---

## Example 9: A/B Test Two Approaches

```
Help me compare two different ways to complete a task:

1. Connect to TestDriver with debugger
2. Create two test files:

   Approach A (tests/approach-a.yaml):
   - Click hamburger menu
   - Click settings
   - Change theme
   
   Approach B (tests/approach-b.yaml):
   - Use keyboard shortcut Ctrl+,
   - Navigate with arrow keys
   - Change theme

3. Run both tests
4. Tell me which approach is faster/more reliable
5. Show me screenshots from both
```

---

## Example 10: Build Test with Error Handling

```
Create a robust test with error handling:

1. Connect to TestDriver
2. Build a test at tests/robust-login.yaml that:
   - Tries to login with invalid credentials
   - Asserts error message appears
   - Clears the form
   - Tries with valid credentials
   - Asserts success

3. For each action:
   - Append to the YAML file
   - Take a screenshot
   - Verify it worked before continuing

4. Run the final test
5. Generate a JavaScript version as well
```

---

## Advanced Workflows

### Workflow 1: TDD with Live Feedback

```
Let's do TDD with live visual feedback:

1. Create an empty test file: tests/new-feature.yaml
2. Connect to TestDriver with debugger (give me the URL)
3. I'll describe what I want to test
4. You append commands to the test file one by one
5. After each command, run JUST that command to verify
6. Take a screenshot so I can see the result
7. I'll tell you to continue or adjust
8. Repeat until test is complete
9. Run the full test from the file

Let's start - create the test for submitting a contact form.
```

### Workflow 2: Exploratory Testing with Documentation

```
Perform exploratory testing and document findings:

1. Connect to TestDriver with debugger
2. Navigate to the application
3. Explore the UI - click around, try different paths
4. For interesting workflows you discover:
   - Create a test file documenting the steps
   - Include screenshots
   - Note any bugs or issues

5. Create these test files:
   - tests/discovered/happy-path.yaml
   - tests/discovered/edge-case-1.yaml
   - tests/discovered/edge-case-2.yaml

6. Summarize what you learned
```

### Workflow 3: Visual Regression Suite

```
Build a visual regression test suite:

1. Connect to TestDriver
2. Navigate through these pages:
   - Homepage
   - Product listing
   - Product detail
   - Cart
   - Checkout

3. For each page:
   - Create a test file (tests/visual/[page].yaml)
   - Navigate to the page
   - Wait for key elements
   - Take screenshot
   - Save screenshot reference

4. Run all tests
5. Show me all the test files created
```

### Workflow 4: Data-Driven Test Generation

```
Generate data-driven tests:

1. Connect to TestDriver
2. Create a template test: tests/login-template.yaml
3. For each of these user types:
   - admin_user
   - standard_user
   - locked_user
   
4. Create a separate test file with the username
5. Run all three tests
6. Create a summary of results
7. Generate a combined test suite file
```

---

## Pro Tips for AI Test Generation

### Use Descriptive File Names
```
Good: tests/user-registration-happy-path.yaml
Bad: tests/test1.yaml
```

### Build Incrementally
```
1. Append command
2. Run it immediately  
3. Verify with screenshot
4. Continue to next command
```

### Keep the Debugger Open
```
Always start with debugger enabled so you can:
- See what the AI is doing
- Verify actions visually
- Debug issues in real-time
```

### Track Action History
```
The MCP server automatically tracks all actions.
You can generate a test file from history at any time:

"Create a test from all the actions I've performed so far"
```

### Combine YAML and JavaScript
```
- Use YAML for quick iteration
- Generate JavaScript for production tests
- Keep both versions in sync
```

---

## Troubleshooting

### Can't See the VM?
```
Make sure you connected with headless: false
Use testdriver_getDebuggerUrl to get the URL
```

### Test File Not Found?
```
Use absolute paths or paths relative to project root
Check file was created with testdriver_readTestFile
```

### Actions Not Being Recorded?
```
The action history is stored in the MCP server session
It clears when you disconnect
Save to file frequently!
```

### Want to Start Fresh?
```
1. Disconnect
2. Reconnect (this clears action history)
3. Start building new test
```

---

## Complete Example Session

Here's a full conversation showing all features:

**You:** "Claude, let's build and test a user registration flow"

**Claude:** "I'll help you create a comprehensive test. Let me start by connecting to TestDriver with the debugger enabled..."

**You:** "Perfect, I can see the VM now. Navigate to the registration page."

**Claude:** "Navigating... Done. I can see the registration form. Should I start recording actions to a test file?"

**You:** "Yes, create tests/user-registration.yaml and append each action"

**Claude:** "I'll build the test step by step:
1. Appending: wait for 'Sign Up' text...
2. Appending: click 'Sign Up' button...
3. Taking screenshot...
4. Appending: type email...
[continues building test]

Test file created with 12 commands. Would you like me to run it?"

**You:** "Yes, and also create a JavaScript version"

**Claude:** "Running YAML test... ✓ Passed
Generating JavaScript version... Done.
Both files ready:
- tests/user-registration.yaml
- tests/user-registration.test.mjs

The JavaScript version is ready to run with vitest."

---

This MCP server gives you complete control over VM spawning, test building, and execution - all through natural language conversation with Claude!
