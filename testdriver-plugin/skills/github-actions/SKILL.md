---
name: github-actions
description: Integrate TestDriver with GitHub Actions. Use when setting up CI/CD pipelines, configuring workflows, or automating test runs on pull requests.
---

# GitHub Actions Integration

Read: `node_modules/testdriverai/docs/v7/ci-cd.mdx`

## Basic Workflow

Create `.github/workflows/testdriver.yml`:

```yaml
name: TestDriver Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
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
        run: npx vitest run
        
      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: test-report.junit.xml
```

## Required Secrets

Add to your repository secrets (Settings → Secrets → Actions):
- `TD_API_KEY` - Your TestDriver API key

## Windows Testing

For Windows sandbox testing, add AWS credentials:

```yaml
- name: Run TestDriver tests (Windows)
  env:
    TD_API_KEY: ${{ secrets.TD_API_KEY }}
    TD_OS: windows
    AWS_REGION: ${{ secrets.AWS_REGION }}
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    AMI_ID: ${{ secrets.AMI_ID }}
    AWS_LAUNCH_TEMPLATE_ID: ${{ secrets.AWS_LAUNCH_TEMPLATE_ID }}
  run: npx vitest run
```

## JUnit Test Reports

TestDriver outputs JUnit XML for CI integration:

```yaml
- name: Publish Test Results
  uses: dorny/test-reporter@v1
  if: always()
  with:
    name: TestDriver Results
    path: test-report.junit.xml
    reporter: java-junit
```

## Parallel Testing

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        test-file: [login, checkout, settings]
    steps:
      # ...
      - name: Run tests
        run: npx vitest run tests/${{ matrix.test-file }}.test.mjs
```
