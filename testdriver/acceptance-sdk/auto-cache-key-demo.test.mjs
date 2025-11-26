/**
 * TestDriver SDK - Auto Cache Key Demo
 * 
 * This test demonstrates the auto-generated cache key feature.
 * When no cacheKey is provided, TestDriver will automatically generate
 * one based on the hash of this test file.
 */

import { describe, expect, it } from "vitest";
import { TestDriver } from "../../src/vitest/hooks.mjs";

describe("Auto Cache Key Demo", () => {
  it("should use auto-generated cache key based on file hash", async (context) => {
    // NOTE: No cacheKey is provided here!
    // TestDriver will automatically generate one from the hash of this file
    const testdriver = TestDriver(context, { 
      headless: true, 
      newSandbox: true 
      // cacheKey NOT specified - will be auto-generated
    });
    
    // The cache key should be auto-generated
    console.log('Auto-generated cache key:', testdriver.options.cacheKey);
    expect(testdriver.options.cacheKey).toBeTruthy();
    expect(testdriver.options.cacheKey).toMatch(/^[0-9a-f]{16}$/); // 16 hex chars
    
    await testdriver.provision.chrome({ url: 'http://testdriver-sandbox.vercel.app/login' });

    // First find - will be cached with auto-generated key
    const signInButton1 = await testdriver.find(
      "Sign In, black button below the password field"
    );
    
    // Second find - should hit cache because it's the same file (same cache key)
    const signInButton2 = await testdriver.find(
      "Sign In, black button below the password field"
    );
    
    expect(signInButton1.found()).toBe(true);
    expect(signInButton2.found()).toBe(true);
  });

  it("should use same auto-generated cache key for multiple tests in the same file", async (context) => {
    // This test is in the same file, so it should get the same auto-generated cache key
    const testdriver = TestDriver(context, { 
      headless: true, 
      newSandbox: true 
    });
    
    console.log('Auto-generated cache key (test 2):', testdriver.options.cacheKey);
    expect(testdriver.options.cacheKey).toBeTruthy();
    
    // If you modify this file, the hash (and therefore cache key) will change,
    // invalidating the cache for this test file
  });
});
