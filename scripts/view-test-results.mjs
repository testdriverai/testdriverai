#!/usr/bin/env node

/**
 * TestDriver SDK Test Results Viewer
 * Displays a formatted summary of test results from the JSON output
 */

import fs from "fs";
import path from "path";

const RESULTS_PATH = "test-results/results.json";

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function displayResults() {
  if (!fs.existsSync(RESULTS_PATH)) {
    console.error("❌ No test results found. Run tests first:");
    console.error("   npm run test:sdk");
    process.exit(1);
  }

  const results = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf8"));

  const total = results.numTotalTests || 0;
  const passed = results.numPassedTests || 0;
  const failed = results.numFailedTests || 0;
  const skipped = results.numPendingTests || 0;
  const duration = results.testResults?.reduce(
    (sum, file) => sum + (file.endTime - file.startTime),
    0,
  );

  console.log("\n🧪 TestDriver SDK Test Results");
  console.log("═".repeat(50));
  console.log(`✅ Passed:   ${passed}/${total}`);
  console.log(`❌ Failed:   ${failed}/${total}`);
  console.log(`⏭️  Skipped:  ${skipped}/${total}`);
  console.log(`⏱️  Duration: ${formatDuration(duration)}`);
  console.log("═".repeat(50));

  if (failed > 0) {
    console.log("\n❌ Failed Tests:\n");
    results.testResults?.forEach((file) => {
      const failedTests =
        file.assertionResults?.filter((test) => test.status === "failed") || [];

      if (failedTests.length > 0) {
        console.log(`📁 ${path.relative(process.cwd(), file.name)}`);
        failedTests.forEach((test) => {
          console.log(`   ❌ ${test.title}`);
          console.log(`      Duration: ${formatDuration(test.duration)}`);
          if (test.failureMessages?.length > 0) {
            console.log("\n      Error:");
            test.failureMessages.forEach((msg) => {
              // Truncate very long error messages
              const truncated =
                msg.length > 500 ? msg.substring(0, 500) + "..." : msg;
              console.log(
                "      " + truncated.split("\n").join("\n      ") + "\n",
              );
            });
          }
        });
        console.log();
      }
    });
  }

  if (passed > 0) {
    console.log("✅ Passed Tests:\n");
    results.testResults?.forEach((file) => {
      const passedTests =
        file.assertionResults?.filter((test) => test.status === "passed") || [];

      if (passedTests.length > 0) {
        console.log(`📁 ${path.relative(process.cwd(), file.name)}`);
        passedTests.forEach((test) => {
          console.log(`   ✅ ${test.title} (${formatDuration(test.duration)})`);
        });
        console.log();
      }
    });
  }

  console.log("\n📊 View detailed HTML report:");
  console.log("   npm run test:sdk:report");
  console.log("   or open: test-results/index.html\n");

  // Exit with error code if tests failed
  process.exit(failed > 0 ? 1 : 0);
}

displayResults();
