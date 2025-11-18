# Migrating from CLI to SDK

This guide helps you migrate from using TestDriver as a CLI tool to using it as an SDK in your JavaScript/Node.js applications.

## Key Differences

### CLI Approach (Old)

```bash
# YAML-based test files
testdriverai run testdriver/my-test.yaml
```

```yaml
# testdriver/my-test.yaml
version: 6.1.10
steps:
  - prompt: "Login to the application"
    commands:
      - command: hover-text
        text: "Email"
      - command: type
        string: "user@example.com"
      - command: hover-text
        text: "Submit"
      - command: wait-for-text
        text: "Dashboard"
```

### SDK Approach (New)

```javascript
// JavaScript-based tests
const TestDriver = require("testdriverai");

async function testLogin() {
  const client = new TestDriver(process.env.TD_API_KEY);
  await client.auth();
  await client.connect();

  await client.hoverText("Email");
  await client.type("user@example.com");
  await client.hoverText("Submit");
  await client.waitForText("Dashboard");

  await client.disconnect();
}
```

## Command Mapping

Here's how CLI commands map to SDK methods:

| YAML Command         | SDK Method           | Example                                   |
| -------------------- | -------------------- | ----------------------------------------- |
| `hover-text`         | `hoverText()`        | `await client.hoverText('Submit')`        |
| `hover-image`        | `hoverImage()`       | `await client.hoverImage('red button')`   |
| `match-image`        | `matchImage()`       | `await client.matchImage('./button.png')` |
| `type`               | `type()`             | `await client.type('hello')`              |
| `press-keys`         | `pressKeys()`        | `await client.pressKeys(['enter'])`       |
| `click`              | `click()`            | `await client.click(100, 200)`            |
| `scroll`             | `scroll()`           | `await client.scroll('down', 500)`        |
| `wait`               | `wait()`             | `await client.wait(3000)`                 |
| `wait-for-text`      | `waitForText()`      | `await client.waitForText('Success')`     |
| `wait-for-image`     | `waitForImage()`     | `await client.waitForImage('logo')`       |
| `scroll-until-text`  | `scrollUntilText()`  | `await client.scrollUntilText('Footer')`  |
| `scroll-until-image` | `scrollUntilImage()` | `await client.scrollUntilImage('banner')` |
| `focus-application`  | `focusApplication()` | `await client.focusApplication('Chrome')` |
| `remember`           | `remember()`         | `await client.remember('user name')`      |
| `assert`             | `assert()`           | `await client.assert('form is visible')`  |
| `exec`               | `exec()`             | `await client.exec('js', code, 5000)`     |

## Converting YAML to SDK

### Example 1: Simple Form Interaction

**YAML (CLI):**

```yaml
version: 6.1.10
steps:
  - prompt: "Fill out contact form"
    commands:
      - command: hover-text
        text: "Name"
      - command: type
        string: "John Doe"
      - command: hover-text
        text: "Email"
      - command: type
        string: "john@example.com"
      - command: hover-text
        text: "Submit"
      - command: wait-for-text
        text: "Thank you"
        timeout: 5000
```

**SDK (JavaScript):**

```javascript
const TestDriver = require("testdriverai");

async function fillContactForm() {
  const client = new TestDriver(process.env.TD_API_KEY);

  await client.auth();
  await client.connect();

  await client.hoverText("Name");
  await client.type("John Doe");
  await client.hoverText("Email");
  await client.type("john@example.com");
  await client.hoverText("Submit");
  await client.waitForText("Thank you", 5000);

  await client.disconnect();
}

fillContactForm();
```

### Example 2: Complex Navigation Flow

**YAML (CLI):**

```yaml
version: 6.1.10
steps:
  - prompt: "Navigate to settings"
    commands:
      - command: focus-application
        name: "Google Chrome"
      - command: wait
        timeout: 2000
      - command: hover-text
        text: "Menu"
      - command: wait
        timeout: 1000
      - command: hover-text
        text: "Settings"
      - command: scroll
        direction: "down"
        amount: 500
      - command: assert
        expect: "The settings page is displayed"
```

**SDK (JavaScript):**

```javascript
const TestDriver = require("testdriverai");

async function navigateToSettings() {
  const client = new TestDriver(process.env.TD_API_KEY);

  await client.auth();
  await client.connect();

  await client.focusApplication("Google Chrome");
  await client.wait(2000);
  await client.hoverText("Menu");
  await client.wait(1000);
  await client.hoverText("Settings");
  await client.scroll("down", 500);
  await client.assert("The settings page is displayed");

  await client.disconnect();
}

navigateToSettings();
```

### Example 3: Using Variables and Loops

**YAML (CLI):**

```yaml
version: 6.1.10
steps:
  - prompt: "Process multiple items"
    commands:
      - command: exec
        language: "js"
        code: |
          const items = ['Item 1', 'Item 2', 'Item 3'];
          result = items;
```

**SDK (JavaScript):**

```javascript
const TestDriver = require("testdriverai");

async function processMultipleItems() {
  const client = new TestDriver(process.env.TD_API_KEY);

  await client.auth();
  await client.connect();

  const items = ["Item 1", "Item 2", "Item 3"];

  for (const item of items) {
    await client.hoverText(item);
    await client.wait(1000);
  }

  await client.disconnect();
}

processMultipleItems();
```

## Benefits of Using SDK

### 1. **Native JavaScript Control Flow**

```javascript
// Use if/else statements
if (await checkCondition()) {
  await client.hoverText("Option A");
} else {
  await client.hoverText("Option B");
}

// Use loops
for (let i = 0; i < 5; i++) {
  await client.scroll("down", 100);
}

// Use try/catch for error handling
try {
  await client.waitForText("Success", 5000);
} catch (error) {
  console.error("Timeout waiting for success message");
}
```

### 2. **Integration with Testing Frameworks**

```javascript
// Jest
describe("Login Flow", () => {
  let client;

  beforeAll(async () => {
    client = new TestDriver(process.env.TD_API_KEY);
    await client.auth();
    await client.connect();
  });

  afterAll(async () => {
    await client.disconnect();
  });

  test("should login successfully", async () => {
    await client.hoverText("Email");
    await client.type("test@example.com");
    await client.hoverText("Submit");
    await client.waitForText("Dashboard");
  });
});
```

### 3. **Dynamic Test Data**

```javascript
const users = [
  { email: "user1@test.com", password: "pass1" },
  { email: "user2@test.com", password: "pass2" },
];

for (const user of users) {
  await client.hoverText("Email");
  await client.type(user.email);
  await client.hoverText("Password");
  await client.type(user.password);
  await client.hoverText("Login");
  await client.waitForText("Dashboard");
  // Logout for next iteration
  await client.hoverText("Logout");
}
```

### 4. **Reusable Functions**

```javascript
async function login(client, email, password) {
  await client.hoverText("Email");
  await client.type(email);
  await client.hoverText("Password");
  await client.type(password);
  await client.hoverText("Login");
  await client.waitForText("Dashboard");
}

async function logout(client) {
  await client.hoverText("Menu");
  await client.hoverText("Logout");
}

// Use anywhere
await login(client, "user@test.com", "password123");
await logout(client);
```

## When to Use CLI vs SDK

### Use CLI When:

- ✅ You need exploratory testing with AI-generated tests
- ✅ You want to quickly prototype tests without writing code
- ✅ You prefer declarative YAML configuration
- ✅ You're using the interactive edit mode

### Use SDK When:

- ✅ You need programmatic control over test execution
- ✅ You want to integrate with existing test frameworks (Jest, Mocha, etc.)
- ✅ You need complex control flow (loops, conditionals, error handling)
- ✅ You want to use dynamic test data
- ✅ You're building automated CI/CD pipelines
- ✅ You need to reuse test logic across multiple tests

## Running Both CLI and SDK

You can use both approaches in the same project:

```json
{
  "scripts": {
    "test:cli": "testdriverai run testdriver/regression.yaml",
    "test:sdk": "node tests/login.test.js",
    "test:all": "npm run test:cli && npm run test:sdk"
  }
}
```

## Best Practices

1. **Use environment variables for credentials:**

```javascript
const client = new TestDriver(process.env.TD_API_KEY);
```

2. **Always disconnect after tests:**

```javascript
try {
  // Your tests
} finally {
  await client.disconnect();
}
```

3. **Create helper functions for common actions:**

```javascript
const helpers = {
  login: async (client, email, password) => {
    /* ... */
  },
  navigateTo: async (client, page) => {
    /* ... */
  },
  fillForm: async (client, data) => {
    /* ... */
  },
};
```

4. **Use async/await consistently:**

```javascript
// ✅ Good
await client.hoverText("Submit");
await client.wait(1000);

// ❌ Bad
client.hoverText("Submit");
client.wait(1000);
```

## Next Steps

- Read the [SDK Documentation](./SDK_README.md) for complete API reference
- Check out [examples](./examples/sdk-example.js) for more use cases
- Join our [Discord](https://discord.com/invite/cWDFW8DzPm) for support
