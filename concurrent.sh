
#!/bin/bash

# Create logs directory
mkdir -p test-logs

# Find all test files and build the concurrently command
TESTS=$(ls ./testdriver/acceptance/*.yaml | xargs -n1 basename)
COMMANDS=""

for test in $TESTS; do
  testname=$(basename "$test" .yaml)
  if [ -n "$COMMANDS" ]; then
    COMMANDS="$COMMANDS "
  fi
  # Each command runs the test and redirects output to separate log file
  COMMANDS="$COMMANDS\"node bin/testdriverai.js run testdriver/acceptance/$test --junit=test-logs/$testname.xml > test-logs/$testname.log 2>&1\""
done

echo "Running tests in parallel..."
echo "Commands: $COMMANDS"

# Run concurrently with the built commands (use -y to auto-install if needed)
eval "npx -y concurrently \
  --prefix \"[{name}]\" \
  --names \"$(ls ./testdriver/acceptance/*.yaml | xargs -n1 basename | sed 's/.yaml//g' | paste -sd ',')\" \
  $COMMANDS"

# Show results summary
echo ""
echo "=== Test Results Summary ==="
total=0
passed=0
failed=0

for logfile in test-logs/*.log; do
  if [ -f "$logfile" ]; then
    testname=$(basename "$logfile" .log)
    total=$((total + 1))
    
    # Check if corresponding junit file exists and has passing tests
    if [ -f "test-logs/$testname.xml" ] && ! grep -q 'failures="[1-9]' "test-logs/$testname.xml" 2>/dev/null && ! grep -q 'errors="[1-9]' "test-logs/$testname.xml" 2>/dev/null; then
      echo "✅ $testname"
      passed=$((passed + 1))
    else
      echo "❌ $testname (see test-logs/$testname.log)"
      failed=$((failed + 1))
    fi
  fi
done

echo ""
echo "Summary: $passed passed, $failed failed, $total total"
echo "All logs available in test-logs/ directory"

# Exit with error if any tests failed
if [ $failed -gt 0 ]; then
  exit 1
fi
