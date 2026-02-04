import { TestDriver } from './lib/vitest/hooks.mjs';
import { describe, it } from 'vitest';

describe('IDE Preview Test', () => {
  it('should open preview in IDE', async (context) => {
    const testdriver = TestDriver(context, {
      preview: 'ide'  // This should write the session file
    });
    
    await testdriver.provision.chrome({ url: 'https://example.com' });
    
    // Give the extension a moment to detect the session file
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('✅ Test completed - check if VSCode extension opened the preview panel');
  });
});
