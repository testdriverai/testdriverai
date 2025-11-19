# SDK Test Reporting - Quick Reference

## 🚀 Commands

```bash
# Run all tests
npm run test:sdk

# View terminal summary
npm run test:sdk:results

# Open HTML report
npm run test:sdk:report

# Watch mode (dev)
npm run test:sdk:watch

# Interactive UI
npm run test:sdk:ui
```

## 📊 What You Get

### Locally

1. **Console**: Verbose logs with full test output
2. **Terminal Summary**: `npm run test:sdk:results` - Quick pass/fail counts
3. **HTML Report**: `npm run test:sdk:report` - Interactive browser viewer

### GitHub Actions

1. **Step Summary**: Markdown tables in workflow summary page
2. **Test Summary Action**: Badge counts and annotations
3. **Artifacts**: Download junit.xml, results.json, and index.html

## 📁 Output Files

```
test-results/
├── junit.xml       # For CI/CD tools
├── results.json    # Machine-readable
└── index.html      # Interactive report
```

## ⚡ Quick Tips

- **Debugging failures?** → `npm run test:sdk:report` (HTML has best error context)
- **Quick status check?** → `npm run test:sdk:results` (terminal summary)
- **PR review?** → Check GitHub Actions summary tab
- **Need history?** → Download artifacts from GitHub Actions runs

## 🔍 GitHub Summary Preview

Every test run creates a summary with:

- ✅ Pass/fail counts table
- ❌ Failed test details with errors
- ✅ List of all passing tests
- ⏱️ Duration metrics

Find it: Actions → Your workflow run → Summary tab
