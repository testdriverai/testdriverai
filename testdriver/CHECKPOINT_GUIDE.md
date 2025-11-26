# TestDriver Checkpoint System Guide

## Overview

When developing and debugging TestDriver tests, you often need to iterate on specific sections without re-running the entire test from scratch. The checkpoint system allows you to skip completed steps by leveraging persistent sandbox state.

## How It Works

When `newSandbox: false` is set in the chrome/firefox preset options, the sandbox VM persists between test runs. This means:
- The browser stays open with all its state
- You remain logged in
- Navigation history is preserved
- Any data entered or modified stays intact

## Setting Up Checkpoints in Your Tests

### 1. Enable Persistent Sandbox

```javascript
const { testdriver } = await chrome(context, {
  url: 'https://your-app.com',
  newSandbox: false  // This enables checkpoint functionality
});
```

### 2. Add Checkpoint Markers

Place checkpoint comments at logical breakpoints in your test:

```javascript
// ========================================================================
// CHECKPOINT 1: Login Complete
// If test fails after this point, comment out all code above this checkpoint
// ========================================================================
```

Suggested checkpoint locations:
- After authentication/login
- After navigation to major sections
- After complex form fills
- Before assertions you're actively debugging
- After data creation steps

### 3. Comment Out Earlier Steps

When your test fails at step 5, you can comment out checkpoints 1-4:

```javascript
/* COMMENTED OUT - Already completed in sandbox
// ========================================================================
// CHECKPOINT 1: Cookie Banner
// ========================================================================
const cookieBanner = await testdriver.find("Accept cookies");
await cookieBanner.click();
*/

// ========================================================================
// CHECKPOINT 2: Currently debugging from here
// ========================================================================
const submitButton = await testdriver.find("Submit button");
// ... continue with your test
```

## Usage Workflow

### Initial Development
1. Write your test with checkpoint markers
2. Set `newSandbox: false`
3. Run the test completely

### Debugging a Failing Step
1. Identify where the test fails
2. Find the checkpoint just before the failure
3. Comment out all code before that checkpoint using `/* ... */`
4. Re-run the test - it will resume from that point
5. Fix the issue
6. Repeat for subsequent failures

### Final Validation
1. Once all steps pass individually
2. Uncomment ALL checkpoint sections
3. Run the complete end-to-end test
4. Verify it passes from start to finish

## Example Test Structure

```javascript
import { chrome } from "../../src/presets/index.mjs";

describe("Multi-step Workflow", () => {
  it("should complete workflow with checkpoints", async (context) => {
    const { testdriver } = await chrome(context, {
      url: 'https://app.example.com',
      newSandbox: false
    });

    // CHECKPOINT 1: Login
    await testdriver.find("email").type("user@example.com");
    await testdriver.find("password").type("password");
    await testdriver.find("login button").click();

    // CHECKPOINT 2: Dashboard loaded
    await testdriver.assert("user is on dashboard");
    
    // CHECKPOINT 3: Form filled
    await testdriver.find("name field").type("Test User");
    await testdriver.find("submit").click();
    
    // CHECKPOINT 4: Success verified
    await testdriver.assert("form submitted successfully");
  });
});
```

## Tips and Best Practices

### Do's ✅
- Always set `newSandbox: false` when using checkpoints
- Add clear, descriptive checkpoint markers
- Include line number hints in checkpoint comments
- Test the full end-to-end flow before committing
- Use meaningful checkpoint names (Login Complete, Form Submitted, etc.)

### Don'ts ❌
- Don't forget to uncomment sections for final validation
- Don't commit code with checkpoints commented out
- Don't use checkpoints for production CI/CD (use `newSandbox: true`)
- Don't skip adding assertions between checkpoints
- Don't create too many checkpoints (3-7 is usually sufficient)

## For AI Assistants

When helping users debug TestDriver tests:

1. **Identify the failure point**: Ask where the test is failing
2. **Suggest checkpoint strategy**: Recommend commenting out earlier sections
3. **Verify newSandbox setting**: Ensure `newSandbox: false` is set
4. **Guide incremental fixes**: Help fix one checkpoint at a time
5. **Remind about final validation**: After all fixes, run the full test

Example AI response:
```
I see the test is failing at the patient profile step. Since you have 
newSandbox: false set, you can comment out checkpoints 1-3 (lines 45-120) 
and re-run the test. The sandbox will still be on the patient page from 
your previous run. Once this section passes, uncomment everything and 
run the full test to validate end-to-end.
```

## Troubleshooting

### "Element not found" even with checkpoints
- The sandbox state may have changed unexpectedly
- Try running from an earlier checkpoint
- Consider adding a screenshot before the failing step
- Verify the URL hasn't changed

### Sandbox is reset between runs
- Verify `newSandbox: false` is set correctly
- Check if the test runner is killing the sandbox
- Ensure you're running the same test file

### Test passes with checkpoints but fails end-to-end
- Some state might not be properly initialized
- Add explicit waits or polling for dynamic content
- Verify all navigation steps are included
- Check for timing-dependent issues

## Related Resources

- [TestDriver SDK Documentation](../SDK_README.md)
- [Best Practices: Polling](../docs/guide/best-practices-polling.mdx)
- [Chrome Preset Options](../src/presets/chrome.mjs)
