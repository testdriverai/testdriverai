#!/bin/bash

# Test script for the init command
# Usage: ./test-init.sh

set -e

echo "🧪 Testing testdriverai init command..."
echo ""

# Cleanup function
cleanup() {
  echo "🧹 Cleaning up test directories..."
  rm -rf /tmp/testdriver-test-*
}

trap cleanup EXIT

# Test 1: Full init with all features
echo "1️⃣  Testing full initialization (package.json, tests, workflow, npm install)..."
cd /tmp
mkdir -p testdriver-test-init
cd testdriver-test-init
node /Users/ianjennings/Development/cli/bin/testdriverai.js init
echo ""
echo "✅ Files created:"
find . -type f -not -path "./node_modules/*" | sort
echo ""
echo "📄 package.json:"
cat package.json
echo ""
echo "📄 vitest.config.js:"
cat vitest.config.js
echo ""
echo "📄 GitHub workflow:"
cat .github/workflows/testdriver.yml
echo ""
echo "📄 First 15 lines of tests/example.test.js:"
head -15 tests/example.test.js
echo ""
echo "📦 Installed dependencies:"
npm list --depth=0
echo ""
echo "---"
echo ""

# Test 2: Help command
echo "2️⃣  Testing help command..."
node /Users/ianjennings/Development/cli/bin/testdriverai.js init --help
echo ""
echo "---"
echo ""

echo "✅ All tests passed!"
