/**
 * Vitest Setup File for Self-Hosted TestDriver Instances
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
 *       'testdriverai/vitest/setup-self-hosted'
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

import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Store instance info per test
const testInstances = new Map();

beforeEach(async (context) => {
  // Only spawn if TD_OS=windows (indicates Windows self-hosted mode)
  if (process.env.TD_OS !== 'windows') {
    return;
  }

  // Verify AWS credentials are available
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_LAUNCH_TEMPLATE_ID || !process.env.AMI_ID) {
    throw new Error('[TestDriver] TD_OS=windows requires AWS credentials (AWS_ACCESS_KEY_ID, AWS_LAUNCH_TEMPLATE_ID, AMI_ID)');
  }

  const testId = context.task.id;
  
  console.log(`[TestDriver] Spawning AWS instance for test: ${context.task.name}`);
  
  try {
    // Find the spawn-runner.sh script (relative to this file)
    const spawnScriptPath = join(__dirname, '../../setup/aws/spawn-runner.sh');
    
    // Execute spawn-runner.sh
    const output = execSync(`sh ${spawnScriptPath}`, {
      encoding: 'utf-8',
      env: {
        ...process.env,
        AWS_REGION: process.env.AWS_REGION || 'us-east-2',
        RESOLUTION: process.env.RESOLUTION || '1920x1080',
      },
      stdio: ['pipe', 'pipe', 'inherit'], // Inherit stderr for real-time logs
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

afterEach(async (context) => {
  const testId = context.task.id;
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
});
