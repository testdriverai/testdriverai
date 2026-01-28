# TestDriver AI Skill

This skill provides capabilities integration for TestDriver.ai, allowing you to create, run, and debug autonomous AI tests.

## Tools

### `setup_testdriver`

Initialize TestDriver in the current project (creates `.env`, etc).

- **Usage**: Call this if the user needs to start a new TestDriver project.

### `create_test`

Create a new TestDriver test file from a template.

- **Args**: `filename` (string), `url` (optional string), `description` (optional string)
- **Usage**: `create_test({ filename: "tests/login.test.mjs", url: "https://app.com" })`

### `run_tests`

Run the tests using Vitest.

- **Args**: `testFile` (optional string)
- **Usage**: `run_tests({ testFile: "tests/login.test.mjs" })` or `run_tests({})` for all.

### `query_results`

Get a list of recent test runs and their identifiers.

## Resources

- `testdriver://dashboard`: HTML dashboard of recent runs.
- `testdriver://run/{id}`: Detailed view of a run with Replay.

## Coding Guide

TestDriver tests are Vitest tests that use the `TestDriver` hook.

### Basic Structure

```javascript
import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/lib/vitest/hooks.mjs";

describe("Scenario", () => {
  it("should work", async (context) => {
    const testdriver = TestDriver(context);
    await testdriver.provision.chrome({ url: "https://example.com" });

    // Actions
    await testdriver.find("button").click();

    // Assertion
    const result = await testdriver.assert("The button was clicked");
    expect(result).toBeTruthy();
  });
});
```

### Key Methods

- `testdriver.find(description)`: Returns an element handle.
- `element.click()`, `element.type(text)`: Interactions.
- `testdriver.assert(description)`: AI verification (returns boolean).
- `testdriver.screenshot()`: Debugging.

### Best Practices

1. **Explicit Steps**: Use `find().click()` over `ai()`.
2. **Screenshots**: Use `await testdriver.screenshot()` to debug.
3. **Reconnection**: Use `TestDriver(context, { reconnect: true })` in a separate file to iterate on an already running session (2-file pattern).
