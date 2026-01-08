/**
 * GitHub Comment Formatter for TestDriver Test Results
 * 
 * This module creates beautiful, formatted GitHub comments with test results,
 * dashcam replays, screenshots, exceptions, and more.
 */

const { Octokit } = require('@octokit/rest');

/**
 * Format test results into a beautiful GitHub comment markdown
 * @param {Object} testRunData - Test run data from Vitest plugin
 * @returns {string} Formatted markdown comment
 */
function formatGitHubComment(testRunData) {
  const { testCases, startTime, endTime, totalDuration } = testRunData;
  
  const passed = testCases.filter(tc => tc.result?.state === 'pass').length;
  const failed = testCases.filter(tc => tc.result?.state === 'fail').length;
  const skipped = testCases.filter(tc => tc.result?.state === 'skip').length;
  
  const statusEmoji = failed > 0 ? '❌' : '✅';
  const statusText = failed > 0 ? 'Failed' : 'Passed';
  
  let comment = `## 🎯 TestDriver Test Results\n\n`;
  comment += `**Status:** ${statusEmoji} ${statusText} • `;
  comment += `${passed} passed`;
  if (failed > 0) comment += `, ${failed} failed`;
  if (skipped > 0) comment += `, ${skipped} skipped`;
  comment += `\n`;
  comment += `**Duration:** ${(totalDuration / 1000).toFixed(1)}s\n\n`;
  
  // Group test cases by file
  const testsByFile = {};
  for (const testCase of testCases) {
    const file = testCase.file || 'unknown';
    if (!testsByFile[file]) {
      testsByFile[file] = [];
    }
    testsByFile[file].push(testCase);
  }
  
  comment += `### Test Cases\n\n`;
  
  for (const [file, tests] of Object.entries(testsByFile)) {
    comment += `#### 📁 ${file}\n\n`;
    
    for (const testCase of tests) {
      const emoji = testCase.result?.state === 'pass' ? '✅' : 
                    testCase.result?.state === 'fail' ? '❌' : '⏭️';
      const testName = testCase.name || 'Unnamed test';
      
      comment += `${emoji} **${testName}**\n\n`;
      
      // Duration
      if (testCase.result?.duration) {
        comment += `- ⏱️ **Duration:** ${(testCase.result.duration / 1000).toFixed(2)}s\n`;
      }
      
      // Dashcam replay
      if (testCase.recordingData?.dashcamUrl) {
        comment += `- 🎬 **Dashcam Replay:** [View recording](${testCase.recordingData.dashcamUrl})\n`;
      }
      
      // Sandbox info
      if (testCase.sandbox?.sandboxId) {
        comment += `- 🖥️ **Sandbox:** \`${testCase.sandbox.sandboxId}\`\n`;
      }
      
      // Exception/error details
      if (testCase.result?.errors && testCase.result.errors.length > 0) {
        comment += `\n<details>\n<summary>❌ Error Details</summary>\n\n`;
        comment += `\`\`\`\n`;
        for (const error of testCase.result.errors) {
          comment += `${error.message || error}\n`;
          if (error.stack) {
            comment += `${error.stack}\n`;
          }
        }
        comment += `\`\`\`\n\n`;
        comment += `</details>\n\n`;
      }
      
      // Screenshots
      if (testCase.recordingData?.screenshots && testCase.recordingData.screenshots.length > 0) {
        comment += `\n<details>\n<summary>📸 Screenshots (${testCase.recordingData.screenshots.length})</summary>\n\n`;
        for (const screenshot of testCase.recordingData.screenshots) {
          if (screenshot.url) {
            comment += `![Screenshot](${screenshot.url})\n\n`;
          }
        }
        comment += `</details>\n\n`;
      }
      
      comment += `\n`;
    }
  }
  
  comment += `---\n\n`;
  comment += `*Powered by [TestDriver.ai](https://testdriver.ai) • `;
  comment += `Generated at ${new Date(endTime).toISOString()}*\n`;
  
  return comment;
}

/**
 * Get GitHub context from environment variables
 * Supports multiple CI/CD environments:
 * - GitHub Actions: GITHUB_TOKEN, GITHUB_REPOSITORY, github.event.pull_request.number
 * - Manual: TD_GITHUB_TOKEN, TD_GITHUB_REPO, TD_GITHUB_PR
 * @returns {Object|null} GitHub context or null if not available
 */
function getGitHubContext() {
  // Try TestDriver-specific env vars first (for manual control)
  let token = process.env.TD_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  let repo = process.env.TD_GITHUB_REPO || process.env.GITHUB_REPOSITORY;
  let prNumber = process.env.TD_GITHUB_PR || 
                 process.env.GITHUB_PR_NUMBER ||
                 process.env.PR_NUMBER;

  // GitHub Actions: try to extract PR number from event path
  if (!prNumber && process.env.GITHUB_EVENT_PATH) {
    try {
      const fs = require('fs');
      const eventData = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
      prNumber = eventData.pull_request?.number;
    } catch (err) {
      // Ignore errors reading event file
    }
  }

  // GitHub Actions: try to extract from GITHUB_REF (refs/pull/123/merge)
  if (!prNumber && process.env.GITHUB_REF) {
    const match = process.env.GITHUB_REF.match(/refs\/pull\/(\d+)\/(merge|head)/);
    if (match) {
      prNumber = match[1];
    }
  }

  if (!token || !repo || !prNumber) {
    return null;
  }

  const [owner, repoName] = repo.split('/');
  if (!owner || !repoName) {
    return null;
  }

  return {
    token,
    owner,
    repo: repoName,
    prNumber: parseInt(prNumber, 10),
  };
}

/**
 * Check if GitHub integration is properly configured
 * @returns {Object} Status object with configured flag and message
 */
function checkGitHubIntegration() {
  const context = getGitHubContext();
  
  if (!context) {
    const missing = [];
    if (!process.env.TD_GITHUB_TOKEN && !process.env.GITHUB_TOKEN) {
      missing.push('GITHUB_TOKEN or TD_GITHUB_TOKEN');
    }
    if (!process.env.TD_GITHUB_REPO && !process.env.GITHUB_REPOSITORY) {
      missing.push('GITHUB_REPOSITORY or TD_GITHUB_REPO');
    }
    if (!process.env.TD_GITHUB_PR && !process.env.GITHUB_PR_NUMBER && !process.env.GITHUB_REF) {
      missing.push('TD_GITHUB_PR or PR number detection');
    }
    
    return {
      configured: false,
      message: `GitHub integration not configured. Missing: ${missing.join(', ')}`,
      context: null,
    };
  }
  
  return {
    configured: true,
    message: `GitHub integration configured for ${context.owner}/${context.repo}#${context.prNumber}`,
    context,
  };
}

/**
 * Post a comment to a GitHub PR
 * @param {Object} testRunData - Test run data from Vitest plugin
 * @returns {Promise<Object>} GitHub API response
 */
async function postGitHubComment(testRunData) {
  const context = getGitHubContext();
  
  if (!context) {
    console.log('ℹ️  Skipping GitHub comment: GitHub context not configured');
    return null;
  }
  
  // Check if comments are explicitly disabled
  if (process.env.TD_GITHUB_COMMENTS === 'false') {
    console.log('ℹ️  Skipping GitHub comment: TD_GITHUB_COMMENTS=false');
    return null;
  }
  
  try {
    const octokit = new Octokit({ auth: context.token });
    const commentBody = formatGitHubComment(testRunData);
    
    // Check if we already posted a comment
    const { data: comments } = await octokit.issues.listComments({
      owner: context.owner,
      repo: context.repo,
      issue_number: context.prNumber,
    });
    
    const botComment = comments.find(c => 
      c.body?.includes('🎯 TestDriver Test Results') && 
      c.user?.login === (process.env.GITHUB_ACTOR || 'github-actions[bot]')
    );
    
    let response;
    if (botComment) {
      // Update existing comment
      response = await octokit.issues.updateComment({
        owner: context.owner,
        repo: context.repo,
        comment_id: botComment.id,
        body: commentBody,
      });
      console.log(`✅ Updated GitHub comment: ${response.data.html_url}`);
    } else {
      // Create new comment
      response = await octokit.issues.createComment({
        owner: context.owner,
        repo: context.repo,
        issue_number: context.prNumber,
        body: commentBody,
      });
      console.log(`✅ Posted GitHub comment: ${response.data.html_url}`);
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ Failed to post GitHub comment:', error.message);
    if (error.status === 401) {
      console.error('   Check that your GITHUB_TOKEN has the correct permissions');
    } else if (error.status === 404) {
      console.error('   Check that the repository and PR number are correct');
    }
    return null;
  }
}

module.exports = {
  formatGitHubComment,
  postGitHubComment,
  getGitHubContext,
  checkGitHubIntegration,
};
