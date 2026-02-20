# Testing GitHub Comments Feature

## Quick Test Instructions

1. **Ensure TD_API_KEY is set**
   - Go to: https://github.com/testdriverai/testdriverai/settings/secrets/actions
   - Add secret named `TD_API_KEY` with your API key from https://console.testdriver.ai/team
   - If already set, you're good to go!

2. **Create a test branch and PR**
   ```bash
   cd /Users/ianjennings/Development/testdriverai
   git checkout -b test-github-comments
   
   # Make a small change to trigger the workflow
   echo "# Test GitHub Comments" >> test-comment.md
   git add test-comment.md
   git commit -m "test: trigger GitHub comment workflow"
   git push origin test-github-comments
   ```

3. **Create Pull Request**
   ```bash
   gh pr create --title "Test: GitHub Comments Feature" \
                --body "Testing automatic GitHub comments with test results and dashcam replays"
   ```
   
   Or create via web: https://github.com/testdriverai/testdriverai/compare

4. **Watch the Magic Happen! ✨**
   - The workflow will automatically run: `.github/workflows/test-with-comments.yml`
   - View progress at: https://github.com/testdriverai/testdriverai/actions
   - After ~30-60 seconds, you'll see a comment on your PR with:
     - ✅ Test results summary
     - 🎥 Embedded dashcam GIF replay
     - 📊 Test statistics
     - 📋 Link to full test run

## What the Test Does

The workflow runs `examples/assert.test.mjs` which:
- Provisions a Chrome browser
- Navigates to https://saucedemo.com
- Performs login actions
- Uses TestDriver's `assert()` to verify elements
- Records a dashcam replay of the entire test
- Posts results to your PR automatically

## Expected Comment Output

You should see a comment like:

```markdown
# 🟢 TestDriver Test Results

**Status:** ✅ PASSED
**Duration:** 25.3s
**Platform:** linux
**Branch:** `test-github-comments`
**Commit:** `abc1234`

## 📊 Test Summary

Total:   1
Passed:  1 ✅
Failed:  0 ❌
Skipped: 0 ⏭️

### [📋 View Full Test Run](https://console.testdriver.ai/runs/...)

## 📝 Test Results

| Status | Test | File | Duration | Replay |
|--------|------|------|----------|--------|
| ✅ | Assert Test | `examples/assert.test.mjs` | 25.3s | [🎥 View](https://console.testdriver.ai/replay/...) |

## 🎥 Dashcam Replays

### Assert Test

[![Assert Test](https://console.testdriver.ai/api/replay/.../gif)](https://console.testdriver.ai/replay/...)

[🎬 View Full Replay](https://console.testdriver.ai/replay/...)
```

## Troubleshooting

### No comment appears
- Check Actions tab for errors: https://github.com/testdriverai/testdriverai/actions
- Verify `TD_API_KEY` secret is set correctly
- Ensure workflow has `pull-requests: write` permission (it does in the provided workflow)

### Workflow doesn't run
- Make sure the workflow file is on the branch you're testing
- Check that PR is from the same repository (not a fork)

### Test fails
- View the workflow logs for details
- Check TestDriver API status
- Verify your API key is valid

## Manual Trigger

You can also trigger the workflow manually:
1. Go to: https://github.com/testdriverai/testdriverai/actions/workflows/test-with-comments.yml
2. Click "Run workflow"
3. Select your branch
4. Click "Run workflow"

Note: Manual triggers won't post PR comments (no PR context), but will still run tests.

## Clean Up

After testing, delete the test branch:
```bash
gh pr close YOUR_PR_NUMBER
git checkout main
git branch -D test-github-comments
git push origin --delete test-github-comments
rm test-comment.md  # if it exists on main
```

## Next Steps

Once you've confirmed it works:
1. Customize the workflow for your needs
2. Add more test files to the run command
3. Set up for all PRs in your repository
4. Share with your team!
