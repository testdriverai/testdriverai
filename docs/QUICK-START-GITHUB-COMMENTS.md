# Quick Start: GitHub Comments

## For GitHub Actions (Easiest!)

Add this to your `.github/workflows/test.yml`:

```yaml
name: Tests

on: pull_request

jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write  # ← This is all you need!
      
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - run: npm ci
      
      - name: Run TestDriver tests
        env:
          TD_API_KEY: ${{ secrets.TD_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}  # Auto-provided
        run: npm test
```

That's it! TestDriver will automatically:
- ✅ Detect the PR number
- ✅ Detect the repository
- ✅ Post beautiful comments with test results
- 🎥 Embed dashcam GIF replays
- 📊 Show pass/fail statistics
- 🔴 Display exception details

## For Local Development

1. **Create a GitHub Personal Access Token**
   - Go to https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Select scope: `repo` or `public_repo`
   - Copy the token

2. **Set environment variables**
   ```bash
   export GITHUB_TOKEN=ghp_your_token_here
   export GITHUB_PR_NUMBER=123
   npm test
   ```

## What Gets Posted

```markdown
# 🟢 TestDriver Test Results

**Status:** ✅ PASSED
**Duration:** 12.3s

## 📝 Test Results
| Status | Test | Duration | Replay |
|--------|------|----------|--------|
| ✅ | Login test | 4.5s | [🎥 View](link) |

## 🎥 Dashcam Replays
[Animated GIF embedded here]
```

## Disable Comments

```bash
TESTDRIVER_SKIP_GITHUB_COMMENT=true npm test
```

## Full Documentation

See [github-integration-setup.md](./github-integration-setup.md) for complete details.
