# GitHub Integration Setup

TestDriver automatically posts beautiful test result comments to GitHub Pull Requests, including:
- ✅ Test results summary with pass/fail counts
- 🎥 Dashcam GIF replays embedded directly in comments
- 📊 Detailed test statistics and duration
- 🔴 Exception details with stack traces
- 📋 Links to full test runs

This guide explains how to configure GitHub authentication so TestDriver can post these comments.

## How It Works

TestDriver's Vitest plugin automatically detects GitHub context and posts comments when tests complete. Here's what it needs:

### Required Environment Variables

1. **GITHUB_TOKEN** or **GH_TOKEN** - GitHub Personal Access Token for authentication
2. **GITHUB_REPOSITORY** - Repository in `owner/repo` format (auto-detected in GitHub Actions)
3. **GITHUB_PR_NUMBER** - Pull Request number (auto-detected in GitHub Actions)
4. **GITHUB_SHA** - Commit SHA (optional, auto-detected in GitHub Actions)

### Auto-Detection in GitHub Actions

When running in GitHub Actions, most variables are automatically available:
- `GITHUB_REPOSITORY` - Set automatically
- `GITHUB_SHA` - Set automatically  
- `GITHUB_REF` - Used to detect PR number
- Pull request info extracted from event data

You only need to configure the token permissions!

### Method 1: GitHub Actions (Recommended)

GitHub Actions provides automatic authentication. TestDriver will detect the context automatically.

**Required Permissions:**

In your workflow file, use the built-in `GITHUB_TOKEN` with write permissions:

```yaml
name: TestDriver Tests

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write  # Required to post comments
      
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run TestDriver tests
        env:
          TD_API_KEY: ${{ secrets.TD_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}  # Automatically provided
        run: npx vitest run
```

**What happens automatically:**
- `GITHUB_TOKEN`: Provided by GitHub Actions
- `GITHUB_REPOSITORY`: Automatically set (e.g., `testdriverai/testdriverai`)
- `GITHUB_REF`: Automatically set (e.g., `refs/pull/123/merge`)
- PR number: Extracted automatically from `GITHUB_REF` or event data

### Method 2: Manual Setup (Local or Other CI)

For local development or other CI systems, set these environment variables:

```bash
# .env or export in your shell
GITHUB_TOKEN=ghp_your_personal_access_token_here
GITHUB_PR_NUMBER=123
# GITHUB_REPOSITORY is auto-detected from git if not set
```

**Creating a Personal Access Token:**

1. Go to [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a descriptive name (e.g., "TestDriver CI")
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
   - Or just ✅ `public_repo` (for public repositories only)
5. Click "Generate token"
6. Copy the token immediately (you won't see it again!)
7. Store it securely:
   - **In GitHub Actions**: Add as repository secret (`Settings → Secrets and variables → Actions → New repository secret`)
   - **Locally**: Add to `.env` file (and add `.env` to `.gitignore`!)

### Method 3: Other CI Systems

#### CircleCI
```yaml
environment:
  GITHUB_TOKEN: $GITHUB_TOKEN
  GITHUB_REPOSITORY: $CIRCLE_PROJECT_USERNAME/$CIRCLE_PROJECT_REPONAME
  GITHUB_PR_NUMBER: $CIRCLE_PR_NUMBER
```

#### GitLab CI
```yaml
variables:
  GITHUB_TOKEN: $GITHUB_TOKEN
  GITHUB_REPOSITORY: "your-org/your-repo"
  GITHUB_PR_NUMBER: $CI_MERGE_REQUEST_IID
```

#### Jenkins
```groovy
environment {
  GITHUB_TOKEN = credentials('github-token')
  GITHUB_REPOSITORY = "${env.GITHUB_ORG}/${env.GITHUB_REPO}"
  GITHUB_PR_NUMBER = "${env.CHANGE_ID}"
}
```

## Environment Variables Reference

| Variable | Priority | Description | Example | Source |
|----------|----------|-------------|---------|--------|
| `GITHUB_TOKEN` | 1 | GitHub personal access token | `ghp_abc...` | Auto-provided in GitHub Actions |
| `GH_TOKEN` | 2 | Alternative GitHub token | `ghp_xyz...` | Manual setup |
| `GITHUB_REPOSITORY` | - | Repository in `owner/repo` format | `testdriverai/testdriverai` | Auto-set in GitHub Actions |
| `GITHUB_PR_NUMBER` | - | Pull request number | `123` | Must be set manually or by CI |
| `GITHUB_SHA` | - | Commit SHA | `abc1234def...` | Auto-set in GitHub Actions |
| `TESTDRIVER_SKIP_GITHUB_COMMENT` | - | Disable comment posting | `true` | Set to skip comments |

**Note**: Git repository info (owner/repo, branch, commit) is auto-detected from your local `.git` directory if not provided via environment variables.

## Disabling GitHub Comments

To disable GitHub comments:

```bash
# Method 1: Set environment variable
TESTDRIVER_SKIP_GITHUB_COMMENT=true npm run test

# Method 2: Remove/unset the GitHub token
unset GITHUB_TOKEN
unset GH_TOKEN
```

In GitHub Actions workflow:
```yaml
- name: Run tests without GitHub comments
  env:
    TD_API_KEY: ${{ secrets.TD_API_KEY }}
    TESTDRIVER_SKIP_GITHUB_COMMENT: true
  run: npx vitest run
```

## Troubleshooting

### "GitHub token not found, skipping comment posting"

Check that the token is set:
```bash
echo $GITHUB_TOKEN  # or GH_TOKEN
```

### "Neither PR number nor commit SHA found"

Set the PR number:
```bash
export GITHUB_PR_NUMBER=123
```

Or ensure `GITHUB_SHA` is set (auto-set in GitHub Actions).

### "Repository info not available"

The plugin auto-detects repo info from your `.git` directory. If that fails, set:
```bash
export GITHUB_REPOSITORY=owner/repo
```

### "Resource not accessible by integration"

Your token doesn't have `pull-requests: write` permission. Check:
- GitHub Actions: Add `permissions.pull-requests: write` to workflow
- Personal token: Ensure it has `repo` or `public_repo` scope

### "Not Found" or "403 Forbidden"

- Token doesn't have access to the repository
- Repository name format is incorrect (must be `owner/repo`)
- PR number is invalid

### Comments not appearing

- Check that tests are running in the context of a pull request
- Verify the token has write access
- Look for error messages in the test output
- Run with `DEBUG=testdriver:github` for verbose logging

## Security Best Practices

1. **Never commit tokens** to git repositories
2. **Use GitHub Actions secrets** for CI/CD
3. **Use fine-grained tokens** with minimum required permissions
4. **Rotate tokens regularly** (at least every 90 days)
5. **Revoke tokens** immediately if compromised
6. **Use organization secrets** for shared tokens across repos

## Example Comment Output

When properly configured, TestDriver will post comments like:

```markdown
# 🟢 TestDriver Test Results

**Status:** ✅ PASSED
**Duration:** 45.23s
**Platform:** linux
**Branch:** `feature/new-login`
**Commit:** `abc1234`

## 📊 Test Summary

Total:   3
Passed:  3 ✅
Failed:  0 ❌
Skipped: 0 ⏭️

### [📋 View Full Test Run](https://app.testdriver.ai/runs/...)

## 📝 Test Results

| Status | Test | File | Duration | Replay |
|--------|------|------|----------|--------|
| ✅ | should log in successfully | `login.test.mjs` | 12.34s | [🎥 View](https://app.testdriver.ai/replay/...) |
| ✅ | should navigate to dashboard | `navigation.test.mjs` | 8.91s | [🎥 View](https://app.testdriver.ai/replay/...) |

## 🎥 Dashcam Replays

### should log in successfully

[![Login test](https://app.testdriver.ai/api/replay/.../gif)](https://app.testdriver.ai/replay/...)

[🎬 View Full Replay](https://app.testdriver.ai/replay/...)

---
<sub>Generated by [TestDriver](https://testdriver.ai) • Run ID: `run_abc123`</sub>
```

The GIF replays are automatically embedded so reviewers can see what happened without leaving GitHub!

## Getting Help

- 📚 [Full Documentation](https://docs.testdriver.ai)
- 💬 [Discord Community](https://discord.gg/testdriver)
- 🐛 [Report Issues](https://github.com/testdriverai/testdriverai/issues)
