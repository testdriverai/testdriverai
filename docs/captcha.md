# Captcha Solving

TestDriver can automatically solve captchas during your tests using the 2captcha service.

## Quick Start

```javascript
const result = await testdriver.captcha({
  apiKey: '2CAPTCHA_API_KEY',
});

console.log(result.success); // true
console.log(result.token);   // The solved captcha token
```

That's it! TestDriver will automatically:
- Detect the captcha type on the page
- Extract the sitekey
- Solve the captcha via 2captcha
- Inject the token into the page
- Trigger any callbacks

## Supported Captcha Types

| Type | Auto-Detected | Notes |
|------|---------------|-------|
| reCAPTCHA v2 | ✅ | Including invisible |
| reCAPTCHA v3 | ✅ | Action is auto-detected |
| hCaptcha | ✅ | |
| Cloudflare Turnstile | ✅ | |

## Getting a 2captcha API Key

1. Sign up at [2captcha.com](https://2captcha.com)
2. Add funds to your account
3. Copy your API key from the dashboard

## Configuration Options

```javascript
const result = await testdriver.captcha({
  // Required
  apiKey: '2CAPTCHA_API_KEY',

  // Optional - usually auto-detected
  sitekey: '6Le...',           // Override auto-detected sitekey
  type: 'recaptcha_v3',        // Override auto-detected type
  action: 'submit',            // reCAPTCHA v3 action

  // Timing
  timeout: 120000,             // Max wait time (default: 120s)
  pollInterval: 5000,          // Poll interval (default: 5s)
});
```

## Full Example

```javascript
import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriver";

describe("Checkout flow", () => {
  it("should complete checkout with captcha", async (context) => {
    const testdriver = TestDriver(context);

    // Navigate to checkout page
    await testdriver.provision.chrome({
      url: 'https://example.com/checkout',
    });

    // Fill out form
    await testdriver.type({ text: 'John Doe', selector: '#name' });
    await testdriver.type({ text: 'john@example.com', selector: '#email' });

    // Solve the captcha
    const result = await testdriver.captcha({
      apiKey: process.env.TWOCAPTCHA_API_KEY,
    });

    expect(result.success).toBe(true);

    // Submit the form
    await testdriver.click({ selector: '#submit' });

    // Verify success
    await testdriver.find({ text: 'Order confirmed' });
  }, 180000);
});
```

## Environment Variables

You can set your API key as an environment variable:

```bash
export TWOCAPTCHA_API_KEY=your_api_key_here
```

Then use it in your tests:

```javascript
const result = await testdriver.captcha({
  apiKey: process.env.TWOCAPTCHA_API_KEY,
});
```

## How It Works

1. **Detection**: Scans the page for captcha elements (`data-sitekey`, script tags, etc.)
2. **Submit**: Sends the captcha challenge to 2captcha's solving service
3. **Poll**: Waits for human solvers to complete the captcha
4. **Inject**: Injects the solved token into the page's hidden fields
5. **Callback**: Triggers any JavaScript callbacks the page expects

## Troubleshooting

### "Could not auto-detect captcha"

The captcha element wasn't found on the page. Try:
- Waiting for the page to fully load before calling `captcha()`
- Providing the `sitekey` and `type` manually

### Timeout errors

Captcha solving typically takes 10-30 seconds. If you're getting timeouts:
- Increase the `timeout` option
- Check your 2captcha balance
- Verify the captcha type is correct

### Token not working

Some sites validate tokens immediately. Make sure:
- The token is injected before form submission
- The captcha type matches what the site expects
- For reCAPTCHA v3, the `action` parameter matches the site's expected action

## Requirements

- Chrome must be launched with remote debugging enabled (automatic on Linux sandboxes)
- A valid 2captcha API key with sufficient balance
