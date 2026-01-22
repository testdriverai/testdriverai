---
name: setup
description: Set up TestDriver in a project. Use when installing testdriverai, configuring vitest, setting up TD_API_KEY, or initializing a new test project.
---

# Setting Up TestDriver

Read the quickstart guide: `node_modules/testdriverai/docs/v7/quickstart.mdx`

## Requirements

1. **API Key** from [console.testdriver.ai/team](https://console.testdriver.ai/team)
2. **Node.js** and **Vitest**

## Setup Steps

### 1. Install TestDriver

```bash
npm install testdriverai vitest dotenv --save-dev
```

### 2. Create `.env` file

```bash
TD_API_KEY=your_api_key_here
```

### 3. Create `vitest.config.mjs`

```javascript
import { config } from 'dotenv';
import TestDriver from 'testdriverai/vitest';
import { defineConfig } from 'vitest/config';

config();

const setupFiles = ['testdriverai/vitest/setup', 'testdriverai/vitest/setup-aws'];

export default defineConfig({
  test: {
    testTimeout: 900000,
    hookTimeout: 900000,
    disableConsoleIntercept: true,
    maxConcurrency: 3,
    reporters: ['default', TestDriver(), ['junit', { outputFile: 'test-report.junit.xml' }]],
    setupFiles,
  },
});
```

### 4. Add to `.gitignore`

```
.env
```

## Verify Setup

Create a test file `tests/example.test.mjs`:

```javascript
import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/lib/vitest/hooks.mjs";

describe("Setup Test", () => {
  it("should load a page", async (context) => {
    const testdriver = TestDriver(context);
    await testdriver.provision.chrome({ url: 'https://example.com' });
    const result = await testdriver.assert("Example Domain heading is visible");
    expect(result).toBeTruthy();
  });
});
```

Run: `npx vitest run tests/example.test.mjs`
