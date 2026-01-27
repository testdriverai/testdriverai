---
name: creating-tests
description: Create TestDriver tests. Use when writing new test files, structuring test suites, using the two-file workflow pattern, or setting up provision for browser/desktop testing.
---

# Creating Tests

Read: `node_modules/testdriverai/docs/v7/quickstart.mdx`

## Basic Test Structure

```javascript
import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/lib/vitest/hooks.mjs";

describe("My Test Suite", () => {
  it("should do something", async (context) => {
    const testdriver = TestDriver(context);
    
    await testdriver.provision.chrome({ url: 'https://example.com' });

    const button = await testdriver.find("Sign In button");
    await button.click();

    const result = await testdriver.assert("dashboard is visible");
    expect(result).toBeTruthy();
  });
});
```

## Provisioning

### Web Testing
```javascript
await testdriver.provision.chrome({ url: 'https://your-app.com' });
```

### Desktop App Testing
```javascript
await testdriver.provision.installer({
  url: 'https://example.com/app.deb',  // or .msi, .exe
  launch: true,
});
```

## Two-File Workflow (Recommended for Development)

Use two files to iterate efficiently without restarting from scratch.

### setup.test.mjs
```javascript
import { afterAll, describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/lib/vitest/hooks.mjs";

describe("Setup", () => {
  afterAll(async () => {
    console.log("Sandbox staying alive for reconnect");
  });

  it("should set up state", async (context) => {
    const testdriver = TestDriver(context);
    await testdriver.provision.chrome({ url: 'https://your-app.com' });
    const result = await testdriver.assert("page loaded");
    expect(result).toBeTruthy();
    console.log("✅ Run experiment.test.mjs now");
  });
});
```

### experiment.test.mjs
```javascript
import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/lib/vitest/hooks.mjs";

describe("Experiment", () => {
  it("should continue", async (context) => {
    const testdriver = TestDriver(context, { reconnect: true });
    // NO provision - sandbox already running
    // Add new steps here...
  });
});
```

Run setup first, then experiment within 2 minutes.

⚠️ **NEVER remove `reconnect: true`** unless combining into a final test.

## TestDriver Options

```javascript
TestDriver(context, {
  newSandbox: true,       // Create new sandbox
  reconnect: false,       // Reconnect to last sandbox
  keepAlive: 30000,       // Keep alive after test (ms)
  os: 'linux',            // 'linux' | 'windows'
  resolution: '1366x768', // Sandbox resolution
});
```

See `node_modules/testdriverai/docs/v7/device-config.mdx` for all options.

## Examples

See `node_modules/testdriverai/examples/` for working test patterns.
