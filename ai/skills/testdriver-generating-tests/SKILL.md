---
name: testdriver:generating-tests
description: Generate tests by exploring your app with the AI vision agent
---
<!-- Generated from generating-tests.mdx. DO NOT EDIT. -->

Start with an exploration of your app. Tests begin here: you describe a flow in plain English. Then the TestDriver vision agent clicks, types, and reads the screen to understand it. Then it writes the test for you. There are no selectors, no DOM, and no weak locators. Only describe what you want to test. Let the agent find the other parts.

There are two methods for an exploration. You can chat with your AI assistant through the TestDriver MCP server. Or you can give a coding agent our instructions file and tell it to generate a test.

<Info>
  Both paths need an MCP-capable AI coding assistant. If you don't have one yet, start with **GitHub Copilot** — there's a [free tier](https://github.com/features/copilot/plans), no credit card required. See [Run → Setup](/copilot/running-tests#setup) for the full install and sign-in walkthrough.
</Info>

## Instructions for Coding Agents

Start with [our quickstart](./quickstart). Then give your coding agent our agent instructions file.

<Card title="TestDriver Agent Instructions" icon="link" arrow="true" horizontal href="https://github.com/testdriverai/testdriverai/blob/main/ai/agents/testdriver.md?plain=1">
  Copy the current version of our agent instructions to provide your coding agent with up-to-date instructions on how to generate TestDriver tests.
</Card>

Then, you can prompt your coding agent to generate tests. Here is an example prompt:

```md
Make me a TestDriver test that does the following steps:

Navigate to practicetestautomation.com
Type username student into Username field
Type password Password123 into Password field
Push Submit button
Verify new page contains expected text 'logged in'
```

<Info>Use explicit commands for production tests. They are at a lower cost, faster, and more reliable.</Info>

## Start a Conversation

Use the TestDriver MCP server and your AI assistant (GitHub Copilot, Cursor, or Claude Desktop) to make tests. You chat with an AI agent. The agent starts a virtual machine, does actions, and writes the test code for you.

Open the chat of your AI assistant. If your project has no other agents, TestDriver uses the TestDriver agent by default. If not, select **testdriver** from the agent dropdown in the chat panel.

Describe what you want to test:

```
Create a test that logs into my app at https://myapp.com
```

The agent will:
1. Start a new session and spawn a Linux virtual machine
2. Launch Chrome and navigate to your URL
3. Execute actions based on your instructions
4. Write the test code to a `.test.mjs` file

<Note>
  The TestDriver agent appears in the agent selection dropdown if you have other agents configured (like `copilot-instructions.md` or other `.agent.md` files). Make sure to select **testdriver** to use TestDriver's MCP tools.
</Note>

## Live Preview Panel

When the agent starts a session, a **live preview panel** opens in your editor. This lets you:

- **Watch tests execute** in real-time
- **Interact with the VM** — click, type, and navigate manually
- **Debug issues** — see exactly what the AI sees

<Note>
  The live preview panel requires the TestDriver VS Code extension. Set `TD_PREVIEW=ide` in your MCP configuration to enable it. See the [Run page](/copilot/running-tests) for all device and preview options.
</Note>

## Interactive Workflow

The recommended workflow for exploring and creating tests:

<Steps>
  <Step title="Describe Your Test">
    Tell the agent what you want to test:

    ```
    Test the checkout flow on https://shop.example.com
    ```
  </Step>

  <Step title="Watch and Guide">
    The agent will start executing. Watch the preview panel and provide guidance if needed:

    ```
    The login modal appeared. Use test@example.com and password123
    ```
  </Step>

  <Step title="Add Assertions">
    Ask the agent to verify specific conditions:

    ```
    Assert that the order confirmation page is shown with the order number
    ```
  </Step>

  <Step title="Review the Code">
    The agent writes test code as it works. Review the generated `.test.mjs` file and make any adjustments.
  </Step>
</Steps>

## Example Conversation

Here's a complete example of exploring and creating a login test:

```
You: Create a test for the login flow at https://console.testdriver.ai

Agent: I'll create a test for the login flow. Starting a session...
       [Screenshot: Login page loaded]

       I can see the login page. Let me find the email input.
       [Screenshot: Email input highlighted]

       Now I'll type the email and find the password field...

You: Use test@example.com for the email

Agent: Got it. Typing test@example.com...
       [Screenshot: Email entered]

       Now entering the password and clicking Sign In...
       [Screenshot: Dashboard loaded]

       ✅ Login successful! I've written the test to tests/login.test.mjs
```

## Generated Test Code

The agent generates standard Vitest test files:

```javascript tests/login.test.mjs
import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/vitest/hooks";

describe("Login Flow", () => {
  it("should log in successfully", async (context) => {
    const testdriver = TestDriver(context);

    await testdriver.provision.chrome({
      url: "https://console.testdriver.ai"
    });

    const emailInput = await testdriver.find("email input field");
    await emailInput.click();
    await testdriver.type("test@example.com");

    const passwordInput = await testdriver.find("password input field");
    await passwordInput.click();
    await testdriver.type("password123");

    const signInButton = await testdriver.find("Sign In button");
    await signInButton.click();

    const result = await testdriver.assert("dashboard is visible");
    expect(result).toBeTruthy();
  });
});
```

## Tips for Better Tests

<AccordionGroup>
  <Accordion title="Be specific with element descriptions">
    Instead of "click the button", say "click the blue Sign In button in the header". More context helps the AI find the right element.
  </Accordion>
  <Accordion title="Add waits for dynamic content">
    If your app has animations or loading states, tell the agent to wait:
    ```
    Wait for the loading spinner to disappear before continuing
    ```
  </Accordion>
  <Accordion title="Use assertions liberally">
    Add assertions after each major action to catch regressions early:
    ```
    Assert that the product was added to the cart
    ```
  </Accordion>
  <Accordion title="Break complex flows into steps">
    For long workflows, create the test incrementally and verify each step works before moving on.
  </Accordion>
</AccordionGroup>

## Next

<Card title="Learn" icon="brain" arrow="true" horizontal href="/caching">
  Once the agent has explored your app, TestDriver caches what it discovers so your tests replay instantly without re-reasoning over the screen every time.
</Card>
