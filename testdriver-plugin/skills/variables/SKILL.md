---
name: variables
description: Use variables in TestDriver tests. Use when parameterizing tests, using environment variables, or passing data between test steps.
---

# Using Variables

Read: `node_modules/testdriverai/docs/v7/variables.mdx`

## Environment Variables

Access via `process.env`:

```javascript
const username = process.env.TEST_USERNAME;
const password = process.env.TEST_PASSWORD;

await testdriver.find("Username input").click();
await testdriver.type(username);
```

## .env File

Create `.env` in project root:

```bash
TD_API_KEY=your_api_key
TEST_USERNAME=testuser@example.com
TEST_PASSWORD=testpass123
BASE_URL=https://staging.example.com
```

Load with dotenv (already configured in vitest.config.mjs):

```javascript
import { config } from 'dotenv';
config();
```

## Parameterized Tests

```javascript
const testCases = [
  { email: 'user1@test.com', expected: 'Welcome User 1' },
  { email: 'user2@test.com', expected: 'Welcome User 2' },
];

describe("Login Tests", () => {
  testCases.forEach(({ email, expected }) => {
    it(`should login ${email}`, async (context) => {
      const testdriver = TestDriver(context);
      await testdriver.provision.chrome({ url: process.env.BASE_URL });
      
      await testdriver.find("Email input").click();
      await testdriver.type(email);
      
      const result = await testdriver.assert(`page shows '${expected}'`);
      expect(result).toBeTruthy();
    });
  });
});
```

## Sharing Data Between Steps

```javascript
it("should complete flow", async (context) => {
  const testdriver = TestDriver(context);
  await testdriver.provision.chrome({ url: 'https://example.com' });
  
  // Get data from page
  const orderId = await testdriver.exec("js", 
    "return document.querySelector('.order-id').textContent", 
    5000
  );
  
  // Use in later assertions
  const result = await testdriver.assert(`Order ${orderId} is confirmed`);
  expect(result).toBeTruthy();
});
```

## Dynamic URLs

```javascript
const baseUrl = process.env.BASE_URL || 'https://localhost:3000';
await testdriver.provision.chrome({ url: `${baseUrl}/login` });
```
