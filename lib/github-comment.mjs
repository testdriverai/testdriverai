/**
 * GitHub Comment Generator for TestDriver Test Results
 * 
 * Creates beautifully formatted GitHub comments with:
 * - Test results summary
 * - Dashcam GIF replays
 * - Exception details
 * - Links to test runs
 */

import { Octokit } from '@octokit/rest';

/**
 * Format test duration in human-readable format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

/**
 * Get status emoji for test result
 * @param {string} status - Test status (passed, failed, skipped)
 * @returns {string} Emoji
 */
function getStatusEmoji(status) {
  switch (status) {
    case 'passed': return '✅';
    case 'failed': return '❌';
    case 'skipped': return '⏭️';
    case 'cancelled': return '🚫';
    default: return '❓';
  }
}

/**
 * Generate markdown for test results table
 * @param {Array} testCases - Array of test case objects
 * @returns {string} Markdown table
 */
function generateTestResultsTable(testCases) {
  if (!testCases || testCases.length === 0) {
    return '_No test cases recorded_';
  }

  let table = '| Status | Test | File | Duration | Replay |\n';
  table += '|--------|------|------|----------|--------|\n';

  for (const test of testCases) {
    const status = getStatusEmoji(test.status);
    const name = test.testName || 'Unknown';
    const file = test.testFile || 'unknown';
    const duration = formatDuration(test.duration || 0);
    const replay = test.replayUrl 
      ? `[🎥 View](${test.replayUrl})` 
      : '-';

    table += `| ${status} | ${name} | \`${file}\` | ${duration} | ${replay} |\n`;
  }

  return table;
}

/**
 * Generate markdown for exceptions/errors
 * @param {Array} testCases - Array of test case objects with errors
 * @returns {string} Markdown with error details
 */
function generateExceptionsSection(testCases) {
  const failedTests = testCases.filter(t => t.status === 'failed' && t.errorMessage);
  
  if (failedTests.length === 0) {
    return '';
  }

  let section = '\n## 🔴 Failures\n\n';
  
  for (const test of failedTests) {
    section += `### ${test.testName}\n\n`;
    section += `**File:** \`${test.testFile}\`\n\n`;
    
    if (test.replayUrl) {
      section += `**📹 [Watch Replay](${test.replayUrl})**\n\n`;
    }
    
    section += '```\n';
    section += test.errorMessage || 'Unknown error';
    section += '\n```\n\n';
    
    if (test.errorStack) {
      section += '<details>\n';
      section += '<summary>Stack Trace</summary>\n\n';
      section += '```\n';
      section += test.errorStack;
      section += '\n```\n';
      section += '</details>\n\n';
    }
  }

  return section;
}

/**
 * Generate markdown for dashcam replays section
 * @param {Array} testCases - Array of test case objects
 * @returns {string} Markdown with replay embeds
 */
function generateReplaySection(testCases) {
  const testsWithReplays = testCases.filter(t => t.replayUrl);
  
  if (testsWithReplays.length === 0) {
    return '';
  }

  let section = '\n## 🎥 Dashcam Replays\n\n';
  
  for (const test of testsWithReplays) {
    section += `### ${test.testName}\n\n`;
    
    // Extract replay ID from URL for GIF embed
    const replayId = extractReplayId(test.replayUrl);
    if (replayId) {
      const gifUrl = getReplayGifUrl(test.replayUrl, replayId);
      section += `[![${test.testName}](${gifUrl})](${test.replayUrl})\n\n`;
      section += `[🎬 View Full Replay](${test.replayUrl})\n\n`;
    } else {
      section += `[🎬 View Replay](${test.replayUrl})\n\n`;
    }
  }

  return section;
}

/**
 * Extract replay ID from dashcam URL
 * @param {string} url - Dashcam replay URL
 * @returns {string|null} Replay ID or null
 */
function extractReplayId(url) {
  if (!url) return null;
  
  // Match pattern: /replay/{id} or /replay/{id}?params
  const match = url.match(/\/replay\/([^?/#]+)/);
  return match ? match[1] : null;
}

/**
 * Get GIF URL for replay
 * @param {string} replayUrl - Full replay URL
 * @param {string} replayId - Replay ID
 * @returns {string} GIF URL
 */
function getReplayGifUrl(replayUrl, replayId) {
  // Extract base URL (remove path after domain)
  const urlObj = new URL(replayUrl);
  const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
  
  // Return GIF endpoint
  return `${baseUrl}/api/replay/${replayId}/gif`;
}

/**
 * Generate complete GitHub comment markdown
 * @param {Object} testRunData - Test run data
 * @param {Array} testCases - Array of test case objects
 * @returns {string} Complete markdown comment
 */
export function generateGitHubComment(testRunData, testCases = []) {
  const {
    runId,
    status,
    totalTests = 0,
    passedTests = 0,
    failedTests = 0,
    skippedTests = 0,
    duration = 0,
    testRunUrl,
    platform = 'unknown',
    branch = 'unknown',
    commit = 'unknown',
  } = testRunData;

  // Header with overall status
  const statusEmoji = getStatusEmoji(status);
  const statusColor = status === 'passed' ? '🟢' : status === 'failed' ? '🔴' : '🟡';
  
  let comment = `# ${statusColor} TestDriver Test Results\n\n`;
  
  // Summary badges/stats
  comment += `**Status:** ${statusEmoji} ${status.toUpperCase()}\n`;
  comment += `**Duration:** ${formatDuration(duration)}\n`;
  comment += `**Platform:** ${platform}\n`;
  comment += `**Branch:** \`${branch}\`\n`;
  comment += `**Commit:** \`${commit.substring(0, 7)}\`\n\n`;
  
  // Test statistics
  comment += '## 📊 Test Summary\n\n';
  comment += '```\n';
  comment += `Total:   ${totalTests}\n`;
  comment += `Passed:  ${passedTests} ✅\n`;
  comment += `Failed:  ${failedTests} ❌\n`;
  comment += `Skipped: ${skippedTests} ⏭️\n`;
  comment += '```\n\n';
  
  // Link to full test run
  if (testRunUrl) {
    comment += `### [📋 View Full Test Run](${testRunUrl})\n\n`;
  }
  
  // Test results table
  comment += '## 📝 Test Results\n\n';
  comment += generateTestResultsTable(testCases);
  
  // Dashcam replays section
  comment += generateReplaySection(testCases);
  
  // Exceptions section (only if there are failures)
  comment += generateExceptionsSection(testCases);
  
  // Footer
  comment += '\n---\n';
  comment += `<sub>Generated by [TestDriver](https://testdriver.ai) • Run ID: \`${runId}\`</sub>\n`;
  
  return comment;
}

/**
 * Post comment to GitHub PR or commit
 * @param {Object} options - Options
 * @param {string} options.token - GitHub token
 * @param {string} options.owner - Repository owner
 * @param {string} options.repo - Repository name
 * @param {number} [options.prNumber] - Pull request number (if commenting on PR)
 * @param {string} [options.commitSha] - Commit SHA (if commenting on commit)
 * @param {string} options.body - Comment body (markdown)
 * @returns {Promise<Object>} GitHub API response
 */
export async function postGitHubComment(options) {
  const { token, owner, repo, prNumber, commitSha, body } = options;
  
  if (!token) {
    throw new Error('GitHub token is required');
  }
  
  if (!owner || !repo) {
    throw new Error('Repository owner and name are required');
  }
  
  if (!prNumber && !commitSha) {
    throw new Error('Either prNumber or commitSha must be provided');
  }

  const octokit = new Octokit({ auth: token });

  if (prNumber) {
    // Comment on PR
    const response = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
    return response.data;
  } else if (commitSha) {
    // Comment on commit
    const response = await octokit.rest.repos.createCommitComment({
      owner,
      repo,
      commit_sha: commitSha,
      body,
    });
    return response.data;
  }
}

/**
 * Update existing GitHub comment
 * @param {Object} options - Options
 * @param {string} options.token - GitHub token
 * @param {string} options.owner - Repository owner
 * @param {string} options.repo - Repository name
 * @param {number} options.commentId - Comment ID to update
 * @param {string} options.body - Updated comment body (markdown)
 * @returns {Promise<Object>} GitHub API response
 */
export async function updateGitHubComment(options) {
  const { token, owner, repo, commentId, body } = options;
  
  if (!token || !owner || !repo || !commentId) {
    throw new Error('Token, owner, repo, and commentId are required');
  }

  const octokit = new Octokit({ auth: token });

  const response = await octokit.rest.issues.updateComment({
    owner,
    repo,
    comment_id: commentId,
    body,
  });
  
  return response.data;
}

/**
 * Find existing TestDriver comment on PR
 * @param {Object} options - Options
 * @param {string} options.token - GitHub token
 * @param {string} options.owner - Repository owner
 * @param {string} options.repo - Repository name
 * @param {number} options.prNumber - Pull request number
 * @returns {Promise<Object|null>} Existing comment or null
 */
export async function findExistingComment(options) {
  const { token, owner, repo, prNumber } = options;
  
  if (!token || !owner || !repo || !prNumber) {
    return null;
  }

  const octokit = new Octokit({ auth: token });

  const comments = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
  });

  // Find comment with TestDriver signature
  const existingComment = comments.data.find(comment =>
    comment.body && comment.body.includes('Generated by [TestDriver]')
  );

  return existingComment || null;
}

/**
 * Post or update GitHub comment with test results
 * Creates new comment or updates existing one
 * @param {Object} testRunData - Test run data
 * @param {Array} testCases - Array of test case objects
 * @param {Object} githubOptions - GitHub API options
 * @returns {Promise<Object>} GitHub API response
 */
export async function postOrUpdateTestResults(testRunData, testCases, githubOptions) {
  const commentBody = generateGitHubComment(testRunData, testCases);
  
  // Try to find and update existing comment
  if (githubOptions.prNumber) {
    const existingComment = await findExistingComment(githubOptions);
    
    if (existingComment) {
      return await updateGitHubComment({
        ...githubOptions,
        commentId: existingComment.id,
        body: commentBody,
      });
    }
  }
  
  // Create new comment
  return await postGitHubComment({
    ...githubOptions,
    body: commentBody,
  });
}
