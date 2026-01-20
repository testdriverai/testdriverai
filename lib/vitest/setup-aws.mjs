/**
 * Vitest Setup File for AWS Self-Hosted TestDriver Instances
 * 
 * This setup file spawns a fresh AWS instance before each test
 * and terminates it after each test completes.
 * 
 * Usage in vitest.config.mjs:
 * ```js
 * export default defineConfig({
 *   test: {
 *     setupFiles: [
 *       'testdriverai/vitest/setup',
 *       'testdriverai/vitest/setup-aws'
 *     ],
 *   },
 * });
 * ```
 * 
 * Required environment variables:
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * - AWS_REGION (default: us-east-2)
 * - AWS_LAUNCH_TEMPLATE_ID
 * - AMI_ID
 */

import { execSync, spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { beforeEach } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Store instance info per test
const testInstances = new Map();

// Global object to share instance termination callbacks with hooks.mjs
globalThis.__testdriverAWS = globalThis.__testdriverAWS || {
  instances: testInstances,
  /**
   * Terminate the instance for a given test ID
   * Called by hooks.mjs after dashcam.stop() completes
   */
  async terminateInstance(testId) {
    const instanceInfo = testInstances.get(testId);
    if (!instanceInfo) {
      return; // No instance was spawned for this test
    }

    const { instanceId, awsRegion } = instanceInfo;

    console.log(`[TestDriver] Terminating AWS instance: ${instanceId}`);

    try {
      execSync(
        `aws ec2 terminate-instances --region "${awsRegion}" --instance-ids "${instanceId}"`,
        {
          encoding: 'utf-8',
          env: process.env,
          stdio: 'inherit',
        }
      );

      console.log(`[TestDriver] Instance terminated: ${instanceId}`);
    } catch (error) {
      console.error('[TestDriver] Failed to terminate instance:', error.message);
      // Don't throw - we don't want to fail the test because of cleanup issues
    } finally {
      testInstances.delete(testId);
    }
  }
};

/**
 * Cleanup function to terminate all running instances
 * Called on process exit to ensure no orphaned instances
 */
function cleanupAllInstances() {
  if (testInstances.size === 0) {
    return;
  }

  console.log(`[TestDriver] Emergency cleanup: terminating ${testInstances.size} instance(s)`);

  for (const [testId, instanceInfo] of testInstances.entries()) {
    const { instanceId, awsRegion } = instanceInfo;
    
    try {
      console.log(`[TestDriver] Terminating instance: ${instanceId}`);
      execSync(
        `aws ec2 terminate-instances --region "${awsRegion}" --instance-ids "${instanceId}"`,
        {
          encoding: 'utf-8',
          stdio: 'inherit',
        }
      );
    } catch (error) {
      console.error(`[TestDriver] Failed to terminate instance ${instanceId}:`, error.message);
    }
  }

  testInstances.clear();
}

// Register cleanup handlers for various exit scenarios
process.on('exit', cleanupAllInstances);
process.on('SIGINT', () => {
  console.log('\n[TestDriver] Received SIGINT, cleaning up instances...');
  cleanupAllInstances();
  // Don't call process.exit here - let the signal handler do its job
});
process.on('SIGTERM', () => {
  console.log('\n[TestDriver] Received SIGTERM, cleaning up instances...');
  cleanupAllInstances();
  // Don't call process.exit here - let the signal handler do its job
});
process.on('uncaughtException', (error) => {
  console.error('[TestDriver] Uncaught exception:', error);
  cleanupAllInstances();
  // Don't call process.exit here - let Node.js handle the exception
});

beforeEach(async (context) => {
  // Only spawn if TD_OS=windows (indicates Windows self-hosted mode)
  if (process.env.TD_OS !== 'windows') {
    return;
  }

  // If TD_IP is already set, use it and skip spawning
  if (process.env.TD_IP) {
    console.log(`[TestDriver] Using existing instance at ${process.env.TD_IP}`);
    context.ip = process.env.TD_IP;
    return;
  }

  // Verify required parameters are available
  if (!process.env.AWS_LAUNCH_TEMPLATE_ID || !process.env.AMI_ID) {
    throw new Error('[TestDriver] TD_OS=windows requires AWS_LAUNCH_TEMPLATE_ID and AMI_ID environment variables');
  }

  // Check if AWS CLI is installed
  try {
    execSync('which aws', { stdio: 'ignore' });
  } catch (error) {
    throw new Error('[TestDriver] AWS CLI is not installed. Install it from https://aws.amazon.com/cli/');
  }

  const testId = context.task.id;
  
  console.log(`[TestDriver] Spawning AWS instance for test: ${context.task.name}`);
  
  try {
    // Find the spawn-runner.sh script (relative to this file)
    const spawnScriptPath = join(__dirname, '../../setup/aws/spawn-runner.sh');
    
    // Execute spawn-runner.sh with live output streaming
    const output = await new Promise((resolve, reject) => {
      const child = spawn('bash', [spawnScriptPath], {
        env: {
          ...process.env,
          AWS_REGION: process.env.AWS_REGION || 'us-east-2',
          RESOLUTION: process.env.RESOLUTION || '1920x1080',
        },
      });

      let stdout = '';
      let stderr = '';

      // Stream stdout in real-time
      child.stdout.on('data', (data) => {
        const str = data.toString();
        process.stdout.write(str); // Show output immediately
        stdout += str;
      });

      // Stream stderr in real-time
      child.stderr.on('data', (data) => {
        const str = data.toString();
        process.stderr.write(str); // Show errors immediately
        stderr += str;
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`spawn-runner.sh exited with code ${code}\n${stderr}`));
        } else {
          resolve(stdout);
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });

    // Parse the output
    const publicIpMatch = output.match(/PUBLIC_IP=(.+)/);
    const instanceIdMatch = output.match(/INSTANCE_ID=(.+)/);
    const awsRegionMatch = output.match(/AWS_REGION=(.+)/);

    if (!publicIpMatch || !instanceIdMatch || !awsRegionMatch) {
      throw new Error('Failed to parse spawn-runner.sh output');
    }

    const publicIp = publicIpMatch[1].trim();
    const instanceId = instanceIdMatch[1].trim();
    const awsRegion = awsRegionMatch[1].trim();

    // Store instance info for this test
    testInstances.set(testId, { publicIp, instanceId, awsRegion });

    // Set IP on test context (not process.env to avoid conflicts in parallel tests)
    context.ip = publicIp;

    console.log(`[TestDriver] Instance spawned: ${instanceId} at ${publicIp}`);
  } catch (error) {
    console.error('[TestDriver] Failed to spawn AWS instance:', error.message);
    throw error;
  }
});

// NOTE: No afterEach hook here!
// Instance termination is now handled by hooks.mjs AFTER dashcam.stop() completes.
// This ensures dashcam can properly stop before the instance is terminated.
