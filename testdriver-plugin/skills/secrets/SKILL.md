---
name: secrets
description: Manage secrets in TestDriver tests. Use when handling passwords, API keys, or sensitive data securely in tests and CI/CD.
---

# Managing Secrets

Read: `node_modules/testdriverai/docs/v7/secrets.mdx`

## Local Development

Use `.env` file (never commit to git):

```bash
# .env
TD_API_KEY=td_xxxxxxxxxxxxx
TEST_PASSWORD=secretpassword123
STRIPE_TEST_KEY=sk_test_xxxxx
```

Add to `.gitignore`:
```
.env
.env.local
```

## Accessing Secrets

```javascript
const password = process.env.TEST_PASSWORD;

await testdriver.find("Password input").click();
await testdriver.type(password);
```

## GitHub Actions Secrets

Add secrets in repository settings (Settings → Secrets → Actions):

```yaml
# .github/workflows/test.yml
- name: Run tests
  env:
    TD_API_KEY: ${{ secrets.TD_API_KEY }}
    TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
  run: npx vitest run
```

## AWS Credentials (for Windows testing)

Required secrets for self-hosted Windows sandboxes:

```yaml
env:
  TD_API_KEY: ${{ secrets.TD_API_KEY }}
  TD_OS: windows
  AWS_REGION: ${{ secrets.AWS_REGION }}
  AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
  AMI_ID: ${{ secrets.AMI_ID }}
  AWS_LAUNCH_TEMPLATE_ID: ${{ secrets.AWS_LAUNCH_TEMPLATE_ID }}
```

## Best Practices

1. **Never hardcode secrets** in test files
2. **Use `.env.example`** to document required variables:
   ```bash
   # .env.example (commit this)
   TD_API_KEY=
   TEST_PASSWORD=
   ```
3. **Rotate secrets** if accidentally exposed
4. **Use different credentials** for test vs production
5. **Limit secret scope** - only expose what's needed

## Masking in Logs

Secrets in environment variables are automatically masked in CI logs. Avoid logging them:

```javascript
// ❌ Don't do this
console.log("Password:", process.env.TEST_PASSWORD);

// ✅ Do this
console.log("Password: [REDACTED]");
```
