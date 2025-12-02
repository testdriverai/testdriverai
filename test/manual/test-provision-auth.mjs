/**
 * Quick test to verify provision() authentication works
 */

import { test } from 'vitest';
import { provision } from './src/presets/index.mjs';

test('provision auth test', async (context) => {
  console.log('Starting provision...');
  
  const { testdriver, dashcam } = await provision('chrome', {
    url: 'http://testdriver-sandbox.vercel.app/',
  }, context);
  
  console.log('✅ Provision complete!');
  console.log('TestDriver:', testdriver);
  console.log('Dashcam:', dashcam);
  
  // Try a simple find
  const result = await testdriver.find('any element');
  console.log('Find result:', result);
});
