import { test, expect } from 'vitest';
import { TestDriver } from 'testdriverai/vitest/hooks';
import { login } from './login.js';

test('should login and add item to cart', async (context) => {

  // Create TestDriver instance - automatically connects to sandbox
  const testdriver = TestDriver(context);

  // Launch chrome and navigate to demo app
  await testdriver.provision.chrome({ url: 'http://testdriver-sandbox.vercel.app/login' });

  // Use the login snippet to handle authentication
  // This demonstrates how to reuse test logic across multiple tests
  await login(testdriver);

  // Add item to cart
  const addToCartButton = await testdriver.find(
    'add to cart button under TestDriver Hat'
  );
  await addToCartButton.click();

  // Open cart
  const cartButton = await testdriver.find(
    'cart button in the top right corner'
  );
  await cartButton.click();

  // Verify item in cart
  const result = await testdriver.assert('There is an item in the cart');
  expect(result).toBeTruthy();
  
});
