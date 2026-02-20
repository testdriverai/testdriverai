# 🎉 GitHub Comments Feature

## What's New

TestDriver now automatically posts beautiful, detailed comments to your GitHub pull requests and commits with:

- ✅ **Test Results** - Pass/fail statistics at a glance
- 🎥 **Dashcam GIF Replays** - Embedded animated previews of each test
- 📊 **Detailed Statistics** - Duration, platform, branch, commit info
- ❌ **Exception Details** - Full error messages and stack traces for failures
- 🔄 **Smart Updates** - Updates existing comments instead of creating duplicates

## Quick Start

### 1. Add to GitHub Actions

```yaml
- name: Run TestDriver tests
  env:
    TD_API_KEY: ${{ secrets.TD_API_KEY }}
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    GITHUB_PR_NUMBER: ${{ github.event.pull_request.number }}
  run: npm run test:sdk
```

### 2. That's it!

TestDriver will automatically detect the CI environment and post comments when:
- `GITHUB_TOKEN` is present
- `GITHUB_PR_NUMBER` (for PR comments) or `GITHUB_SHA` (for commit comments) is set

## Example Comment

![GitHub Comment Preview](https://placeholder.com/github-comment-preview.png)

Your team will see:
- **Status badges** with pass/fail counts
- **Embedded GIF replays** directly in the comment
- **Clickable links** to full test runs and individual replays
- **Collapsible error details** with full stack traces

## Features

### 🎥 Dashcam Replays

Every test automatically records a dashcam replay. These appear in the GitHub comment as:
1. **GIF preview** - Shows the test execution as an animated image
2. **Link to full replay** - Opens the complete replay in TestDriver console
3. **Test-specific context** - Each test has its own replay section

### 📊 Test Statistics

The comment shows:
- Total test count
- Pass/fail/skip breakdown
- Total execution time
- Platform (Linux/Windows/Mac)
- Git branch and commit

### ❌ Exception Handling

Failed tests include:
- Error message prominently displayed
- Collapsible stack trace
- Direct link to the failing test's replay
- File and line number information

### 🔄 Comment Updates

TestDriver intelligently:
- **Updates existing comments** on subsequent pushes to the same PR
- **Creates new comments** only when needed
- **Identifies its own comments** using a signature

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TD_API_KEY` | TestDriver API key | ✅ Yes |
| `GITHUB_TOKEN` | GitHub token | ✅ Yes |
| `GITHUB_PR_NUMBER` | PR number for PR comments | 📝 Recommended |
| `GITHUB_SHA` | Commit SHA (fallback) | ⚙️ Auto-detected |
| `TESTDRIVER_SKIP_GITHUB_COMMENT` | Set to 'true' to disable | ❌ No |

### Disabling Comments

To disable GitHub comments for a specific run:

```bash
TESTDRIVER_SKIP_GITHUB_COMMENT=true npm run test
```

## Documentation

For complete documentation, see:
- **[GitHub Comments Guide](./GITHUB_COMMENTS.md)** - Full setup and configuration
- **[Example Workflow](./../examples/github-actions.yml)** - Copy-paste GitHub Actions workflow
- **[Example Test](./../examples/github-comment-demo.test.mjs)** - Demo test file

## Troubleshooting

### Comment not appearing?

1. **Check environment variables:**
   ```bash
   echo "Token: ${GITHUB_TOKEN:0:10}..."
   echo "PR: $GITHUB_PR_NUMBER"
   ```

2. **Verify permissions:**
   - GitHub Actions needs `pull-requests: write` or `contents: write`

3. **Check logs:**
   - Look for "Posting GitHub comment..." in test output
   - Check for "GitHub token not found" warnings

### Replays not embedded?

- Ensure tests are using `await testdriver.provision.*()` 
- Check that dashcam stops successfully (look for "🎥 Dashcam URL")
- Verify replay URLs in test output

## Examples

### Basic Test with Comment

```javascript
it("should login successfully", async (context) => {
  const testdriver = TestDriver(context, { headless: true });
  
  await testdriver.provision.chrome({
    url: 'https://your-app.com/login',
  });

  // Test steps...
  const result = await testdriver.assert("I'm logged in");
  expect(result).toBeTruthy();
  
  // Dashcam automatically recorded and will appear in GitHub comment!
});
```

### Local Testing

Run locally without posting comments:

```bash
npm run test:sdk
```

Run locally WITH comment posting (requires token):

```bash
GITHUB_TOKEN=ghp_xxx GITHUB_PR_NUMBER=123 npm run test:sdk
```

## Support

- **Documentation:** [testdriver.ai/docs](https://testdriver.ai/docs)
- **Issues:** [GitHub Issues](https://github.com/testdriverai/testdriverai/issues)
- **Discord:** [Join our community](https://discord.gg/testdriver)

---

Made with ❤️ by the TestDriver team
