/**
 * Vitest Custom Reporter for SDK Tests
 * Enhances JUnit XML with dashcam URLs and creates GitHub Actions summary
 */

import fs from 'fs';
import path from 'path';
import { getTestResults } from './testHelpers.mjs';

export default class TestResultsReporter {
  onFinished(files, errors) {
    const results = getTestResults();
    
    // Output summary to console
    console.log('\n' + '='.repeat(60));
    console.log('📋 Test Execution Summary');
    console.log('='.repeat(60));
    console.log(`Total tests: ${results.tests.length}`);
    console.log(`Duration: ${(results.duration / 1000).toFixed(2)}s`);
    console.log(`Tests with dashcam URLs: ${results.tests.filter(t => t.dashcamUrl).length}`);
    
    // Print dashcam URLs
    if (results.tests.some(t => t.dashcamUrl)) {
      console.log('\n🎥 Dashcam URLs:');
      results.tests.forEach(test => {
        if (test.dashcamUrl) {
          console.log(`  - ${test.name}: ${test.dashcamUrl}`);
        }
      });
    }
    console.log('='.repeat(60) + '\n');
    
    // Create GitHub Actions summary if running in CI
    if (process.env.GITHUB_ACTIONS === 'true') {
      this.createGitHubSummary(results);
    }
  }
  
  createGitHubSummary(results) {
    const summaryFile = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryFile) return;
    
    let summary = '# 🎬 TestDriver SDK Test Results\n\n';
    summary += `**Total Tests:** ${results.tests.length}  \n`;
    summary += `**Duration:** ${(results.duration / 1000).toFixed(2)}s  \n`;
    summary += `**Tests with Dashcam:** ${results.tests.filter(t => t.dashcamUrl).length}\n\n`;
    
    if (results.tests.some(t => t.dashcamUrl)) {
      summary += '## 🎥 Dashcam Recordings\n\n';
      summary += '| Test | Dashcam URL |\n';
      summary += '|------|-------------|\n';
      
      results.tests.forEach(test => {
        if (test.dashcamUrl) {
          const testName = test.name || path.basename(test.file);
          summary += `| ${testName} | [View Recording](${test.dashcamUrl}) |\n`;
        }
      });
    }
    
    fs.appendFileSync(summaryFile, summary);
    console.log('✅ GitHub Actions summary created');
  }
}
