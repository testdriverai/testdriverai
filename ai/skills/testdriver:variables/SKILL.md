---
name: testdriver:variables
description: Use dynamic data and secure secrets in your tests
---
<!-- Generated from variables.mdx. DO NOT EDIT. -->

Scale your testing with dynamic data and secure secrets management. Choose the right approach based on your testing needs.

## Environment Variables

Environment variables are ideal for **configuration that changes between environments** (dev, staging, production) or for **secrets that shouldn't be committed to code**. Use this approach when you need to run the same tests against different servers or with different credentials.

```javascript
import { test } from 'vitest';
import { chrome } from 'testdriverai/presets';

test('multi-environment testing', async (context) => {
  const env = process.env.TEST_ENV || 'staging';
  const urls = {
    dev: 'https://dev.myapp.com',
    staging: 'https://staging.myapp.com',
    production: 'https://myapp.com'
  };

  const { testdriver } = await chrome(context, { 
    url: urls[env] 
  });

  await testdriver.assert('app is running');
});
```

```bash
# Run against different environments
TEST_ENV=dev npx vitest run
TEST_ENV=staging npx vitest run
TEST_ENV=production npx vitest run
```

## Test Fixtures

Test fixtures work best when you have **structured, reusable test data** that needs to be shared across multiple tests. Use fixtures when testing different user roles, product catalogs, or any scenario where you want to parameterize tests with a known set of data.

```javascript test/fixtures/users.js
export const testUsers = [
  { email: 'admin@test.com', role: 'admin' },
  { email: 'user@test.com', role: 'user' },
  { email: 'guest@test.com', role: 'guest' }
];

export const products = [
  { name: 'Laptop', price: 999 },
  { name: 'Mouse', price: 29 },
  { name: 'Keyboard', price: 89 }
];
```

```javascript test/permissions.test.js
import { test } from 'vitest';
import { chrome } from 'testdriverai/presets';
import { testUsers } from './fixtures/users.js';

test.each(testUsers)('$role can access dashboard', async ({ email, role }, context) => {
  const { testdriver } = await chrome(context, { url });
  
  await testdriver.find('email input').type(email);
  await testdriver.find('password input').type('password123');
  await testdriver.find('login button').click();
  
  if (role === 'admin') {
    await testdriver.assert('admin panel is visible');
  } else {
    await testdriver.assert('user dashboard is visible');
  }
});
```

## Dynamic Data Generation

Dynamic data generation is perfect for **creating unique test data on each run**, avoiding conflicts with existing records, and **testing edge cases with realistic data**. Use libraries like Faker when you need fresh emails, names, or other data that won't collide with previous test runs.

```javascript
import { test } from 'vitest';
import { chrome } from 'testdriverai/presets';
import { faker } from '@faker-js/faker';

test('user registration with dynamic data', async (context) => {
  const { testdriver } = await chrome(context, { url });

  // Generate unique test data for each run
  const userData = {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
    password: faker.internet.password({ length: 12 })
  };

  await testdriver.find('first name input').type(userData.firstName);
  await testdriver.find('last name input').type(userData.lastName);
  await testdriver.find('email input').type(userData.email);
  await testdriver.find('password input').type(userData.password);
  await testdriver.find('register button').click();

  await testdriver.assert('registration successful');
  console.log('Registered user:', userData.email);
});
```

```bash
npm install --save-dev @faker-js/faker
```
