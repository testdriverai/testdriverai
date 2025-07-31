# JUnit Test Reporting

The TestDriver CLI now supports generating JUnit XML test reports with enhanced formatting, including ANSI color code conversion to HTML and pretty-printed JSON objects. These reports are widely used in CI/CD systems for test result visualization and reporting.

## Usage

Generate a JUnit XML report by using the `--junit` flag with the `run` command:

```bash
# Basic usage
testdriverai run test.yaml --junit=test-results.xml

# Multiple tests
testdriverai run testdriver/acceptance/*.yaml --junit=results/junit.xml

# With other flags
# With other flags
testdriverai run test.yaml --junit=test-results.xml --headless --heal
```

## Viewing HTML Reports

TestDriver includes built-in support for generating beautiful HTML reports from JUnit XML:

```bash
# Generate and view HTML report (using your junit file)
cp your-test-results.xml out.xml
npm run report

# Or manually:
npm run generate-report  # Creates report.html
npm run serve-report     # Serves on http://localhost:8080
```

The HTML report provides:

- **Interactive test results** with expand/collapse functionality
- **Colored output** with ANSI codes converted to HTML styling
- **Formatted JSON** objects with proper indentation
- **Timeline view** of test execution
- **Failure details** with stack traces and error context

## Example Output

````

## Output Format

The JUnit XML report includes enhanced formatting features:

- **Test suite information**: Name, total tests, failures, errors, execution time
- **Individual test cases**: Name, class, execution time, status
- **Failure details**: Error messages and stack traces for failed tests
- **Enhanced system output**:
  - ANSI color codes converted to HTML spans with proper styling
  - JSON objects formatted with proper indentation in `<pre>` blocks
  - Detailed logs of command execution and steps
- **Timing information**: Precise execution times for performance tracking

### ANSI Color Support

TestDriver's colored terminal output is preserved in HTML reports:
- Green text (success messages) → `<span style="color:#0A0">text</span>`
- Red text (error messages) → `<span style="color:#A00">text</span>`
- Bold text → `<b>text</b>`
- Cyan text (info messages) → `<span style="color:#0AA">text</span>`

### JSON Formatting

Complex data structures are automatically formatted for readability:
```json
{
  "command": "assert",
  "args": ["page loaded"],
  "metadata": {
    "selector": "#main-content",
    "timeout": 5000
  }
}
````

## Example Output

```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="1" failures="0" errors="0" skipped="0">
  <testsuite name="TestDriver" tests="1" failures="0" errors="0" skipped="0">
    <testcase classname="TestDriver" name="example" time="2.456">
      <system-out><![CDATA[
Command started: {"command":"assert","args":["page loaded"]}
[info] Checking if page is loaded...
Command succeeded: {"command":"assert"}
      ]]></system-out>
    </testcase>
  </testsuite>
</testsuites>
```

## CI/CD Integration

The generated JUnit XML reports can be consumed by most CI/CD systems:

### GitHub Actions

```yaml
- name: Run TestDriver Tests
  run: testdriverai run tests/ --junit=test-results.xml

- name: Publish Test Results
  uses: dorny/test-reporter@v1
  if: always()
  with:
    name: TestDriver Results
    path: test-results.xml
    reporter: java-junit
```

### Jenkins

```groovy
pipeline {
    stages {
        stage('Test') {
            steps {
                sh 'testdriverai run tests/ --junit=test-results.xml'
            }
            post {
                always {
                    junit 'test-results.xml'
                }
            }
        }
    }
}
```

### GitLab CI

```yaml
test:
  script:
    - testdriverai run tests/ --junit=test-results.xml
  artifacts:
    reports:
      junit: test-results.xml
```

## Event Tracking

The JUnit reporter tracks the following TestDriver events:

- `test:start` / `test:stop` - Test execution boundaries (entire test file)
- `test:success` / `test:error` - Test completion status
- `command:start` / `command:success` / `command:error` - Individual command execution
- `step:start` / `step:success` / `step:error` - Test step execution
- `error:general` / `error:fatal` - General error handling
- `log:*` - Output and logging information
- `exit` - Process termination and final status

## Configuration Options

When using the JUnit reporter programmatically:

```javascript
const { createJUnitReporter } = require("./interfaces/junit");

const reporter = createJUnitReporter(emitter, {
  outputPath: "custom-results.xml", // Output file path
  suiteName: "Custom Test Suite", // Test suite name in XML
});
```

## Implementation Details

The JUnit reporter is implemented following the same pattern as the logger interface:

1. **Event-driven**: Listens to TestDriver events without interfering with execution
2. **Non-blocking**: Operates asynchronously and doesn't impact test performance
3. **Robust error handling**: Continues operation even if individual events fail
4. **Standard compliance**: Generates valid JUnit XML that works with all major tools
5. **Enhanced formatting**: Converts ANSI codes to HTML and formats JSON for readability

The reporter uses the `junit-report-builder` npm package for XML generation and the `ansi-to-html` package for color conversion, ensuring compatibility with the JUnit XML schema used by most CI/CD systems while providing rich, readable output in HTML viewers.
